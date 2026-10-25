import { Injectable, Logger } from '@nestjs/common';
import {
  PitchGraphNode,
  PitchGraphNodeStatus,
  PitchNodeSource,
} from '@pitcharena/shared';
import { PitchGraphSession } from './pitch-graph-session';
import { ChunkClassifierService } from './chunk-classifier.service';
import { randomUUID } from 'crypto';

export interface DiffAlignmentResult {
  alignmentTimeMs: number;
  missingSegmentsRecovered: number;
  newRefinedNodes: number;
  newStagingItems: number;
  recoveredSegments: string[];
}

/**
 * Service thực thi Single-Pass Diff Alignment khi kết thúc bài thuyết trình (FR-03, NFR-02)
 * Đối soát toàn diện 1 lần duy nhất giữa fullRawTranscript và In-Memory Graph để bù đắp các chunk bị mất do mạng trong <= 400ms.
 */
@Injectable()
export class DiffAlignmentService {
  private readonly logger = new Logger(DiffAlignmentService.name);

  // Ngưỡng thời gian tối đa theo yêu cầu NFR-02 (400ms)
  public static readonly MAX_ALIGNMENT_BUDGET_MS = 400;

  /**
   * Quét đối chiếu Single-Pass giữa fullRawTranscript và đồ thị hiện có trên RAM (FR-03)
   */
  public async align(
    session: PitchGraphSession,
    fullRawTranscript: string,
    classifierService: ChunkClassifierService
  ): Promise<DiffAlignmentResult> {
    const startTime = performance.now();

    const rawTrimmed = (fullRawTranscript || '').trim();
    if (!rawTrimmed) {
      return {
        alignmentTimeMs: Math.round(performance.now() - startTime),
        missingSegmentsRecovered: 0,
        newRefinedNodes: 0,
        newStagingItems: 0,
        recoveredSegments: [],
      };
    }

    // 1. Thu thập toàn bộ nội dung đã có trong đồ thị (Active Nodes + Staging Buffer)
    const existingTexts: string[] = [
      ...session.getActiveNodes().map((n) => n.value),
      ...session.stagingBuffer.map((s) => s.text),
      ...Array.from(session.nodes.values()).map((n) => n.value),
    ];

    // Chuẩn hóa kho văn bản hiện có để đối soát nhanh trong RAM (O(N))
    const corpusNormalized = existingTexts
      .map((t) => this.normalizeText(t))
      .filter((t) => t.length > 0);

    // Tiền tính toán trước tập từ vựng cho corpus để tối ưu O(1) set lookup
    const corpusWordSets: Set<string>[] = corpusNormalized.map(
      (t) => new Set(t.split(/\s+/).filter((w) => w.length > 1))
    );

    // 2. Phân tách fullRawTranscript thành các phân đoạn theo câu hoặc dấu ngắt tự nhiên
    const candidateSegments = this.segmentTranscript(rawTrimmed);
    const recoveredSegments: string[] = [];
    let newRefinedNodes = 0;
    let newStagingItems = 0;

    const baselineNodes = session
      .getActiveNodes()
      .filter((n) => n.source === PitchNodeSource.WORD_BASELINE);

    // 3. Quét Single-Pass từng phân đoạn
    for (const segment of candidateSegments) {
      const normalizedSeg = this.normalizeText(segment);
      if (normalizedSeg.length < 8) continue; // Bỏ qua đoạn quá ngắn hoặc vô nghĩa

      // Kiểm tra xem phân đoạn này đã được bao hàm trong đồ thị hay chưa
      const isAlreadyCovered = this.isSegmentCovered(
        normalizedSeg,
        corpusNormalized,
        corpusWordSets
      );
      if (isAlreadyCovered) continue;

      // Phân đoạn chưa có trong đồ thị -> Rớt mạng/chưa nhận kịp -> Bù đắp ngay
      const classification = classifierService.classifyChunk(segment, baselineNodes);
      if (classification.isNoise) {
        continue;
      }

      recoveredSegments.push(segment);

      if (classification.routing === 'REFINED') {
        const newNodeId = randomUUID();
        const newNode: PitchGraphNode = {
          id: newNodeId,
          sessionId: session.sessionId,
          sectionType: classification.sectionType,
          category: classification.category,
          key: this.extractKey(segment),
          value: segment,
          status: PitchGraphNodeStatus.ACTIVE,
          source: PitchNodeSource.PITCH_REFINED,
          confidence: classification.similarityScore,
          sequenceId: ++session.lastSequenceId,
          timestamp: Date.now(),
          originalSentence: segment,
        };
        session.addNode(newNode);
        newRefinedNodes++;
      } else if (classification.routing === 'STAGING') {
        session.addStagingItem({
          sequenceId: ++session.lastSequenceId,
          text: segment,
          timestamp: Date.now(),
          category: classification.category,
          detectedMarkers: [],
        });
        newStagingItems++;
      }

      // Cập nhật corpus để các phân đoạn trùng lặp phía sau không bị thêm nhiều lần
      corpusNormalized.push(normalizedSeg);
      corpusWordSets.push(
        new Set(normalizedSeg.split(/\s+/).filter((w) => w.length > 1))
      );
    }

    const alignmentTimeMs = Math.round(performance.now() - startTime);

    if (alignmentTimeMs > DiffAlignmentService.MAX_ALIGNMENT_BUDGET_MS) {
      this.logger.warn(
        `[DiffAlignmentService] ⚠️ Alignment budget exceeded: ${alignmentTimeMs}ms > ${DiffAlignmentService.MAX_ALIGNMENT_BUDGET_MS}ms`
      );
    } else {
      this.logger.log(
        `[DiffAlignmentService] ✅ Single-Pass Diff Alignment completed in ${alignmentTimeMs}ms: ` +
          `recovered ${recoveredSegments.length} missing segments (Refined: ${newRefinedNodes}, Staged: ${newStagingItems})`
      );
    }

    return {
      alignmentTimeMs,
      missingSegmentsRecovered: recoveredSegments.length,
      newRefinedNodes,
      newStagingItems,
      recoveredSegments,
    };
  }

  /**
   * Phân tách transcript thành danh sách các mệnh đề/câu độc lập
   * Chú ý: Tránh cắt nhầm số thập phân như 1.2 tỷ, 94.2% bằng lookaround (?:\.(?!\d))
   */
  public segmentTranscript(text: string): string[] {
    const rawSentences = text
      .split(/(?:\.(?!\d)|[\?\!\n]+|;\s+)/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const segments: string[] = [];
    for (const sentence of rawSentences) {
      const words = sentence.split(/\s+/).filter(Boolean);
      if (words.length > 25) {
        const subChunks = sentence.split(/(?:,\s+|\s+và\s+|\s+đồng\s*thời\s+)/i);
        for (const sub of subChunks) {
          const trimmedSub = sub.trim();
          if (trimmedSub.length > 0) {
            segments.push(trimmedSub);
          }
        }
      } else {
        segments.push(sentence);
      }
    }
    return segments;
  }

  /**
   * Kiểm tra xem một phân đoạn đã xuất hiện trong corpus đồ thị hay chưa
   * Dùng kỹ thuật kiểm tra chuỗi con và trùng khớp từ khóa (Jaccard similarity >= 0.75)
   */
  public isSegmentCovered(
    candidateNorm: string,
    corpusNormalized: string[],
    corpusWordSets?: Set<string>[]
  ): boolean {
    for (const existing of corpusNormalized) {
      // Existing chứa toàn bộ candidate -> candidate đã được bao hàm
      if (existing.includes(candidateNorm)) {
        return true;
      }
      // Candidate chứa existing CHỈ KHI existing có độ dài tương đương (tránh dính cụm từ ngắn)
      if (
        candidateNorm.includes(existing) &&
        existing.length >= candidateNorm.length * 0.85
      ) {
        return true;
      }
    }

    const candWords = new Set(candidateNorm.split(/\s+/).filter((w) => w.length > 1));
    if (candWords.size === 0) return true;

    if (corpusWordSets && corpusWordSets.length === corpusNormalized.length) {
      for (const existWords of corpusWordSets) {
        let intersection = 0;
        for (const w of candWords) {
          if (existWords.has(w)) intersection++;
        }
        const overlapRatio = intersection / candWords.size;
        if (overlapRatio >= 0.75) {
          return true;
        }
      }
    } else {
      for (const existing of corpusNormalized) {
        const existWords = new Set(existing.split(/\s+/).filter((w) => w.length > 1));
        let intersection = 0;
        for (const w of candWords) {
          if (existWords.has(w)) intersection++;
        }
        const overlapRatio = intersection / candWords.size;
        if (overlapRatio >= 0.75) {
          return true;
        }
      }
    }

    return false;
  }

  public normalizeText(text: string): string {
    return (text || '')
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'…\\\[\]]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractKey(text: string): string {
    const words = text.trim().split(/\s+/).slice(0, 5);
    return words.join('_').toLowerCase();
  }
}
