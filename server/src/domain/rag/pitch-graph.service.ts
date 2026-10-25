import { Injectable, Logger, Optional } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  C2SStreamPitchChunkPayload,
  C2SFinalizePitchStreamPayload,
  S2CPitchGraphSyncPayload,
  PitchGraphNode,
  PitchGraphNodeStatus,
  PitchNodeSource,
  PitchSectionType,
  BusinessWhitelistCategory,
  PitchGraphEdgeType,
  RetractionMarkerType,
} from '@pitcharena/shared';
import { PitchGraphSession } from './pitch-graph-session';
import { DocumentService } from '../../document/document.service';
import { ChunkClassifierService } from './chunk-classifier.service';
import { Section6BuilderService } from './section6-builder.service';
import { DiffAlignmentService } from './diff-alignment.service';

@Injectable()
export class PitchGraphService {
  private readonly logger = new Logger(PitchGraphService.name);
  private readonly sessions = new Map<string, PitchGraphSession>();
  private readonly classifierService: ChunkClassifierService;
  private readonly section6Builder: Section6BuilderService;
  private readonly diffAlignmentService: DiffAlignmentService;

  constructor(
    @Optional() private readonly documentService?: DocumentService,
    @Optional() classifierService?: ChunkClassifierService,
    @Optional() section6Builder?: Section6BuilderService,
    @Optional() diffAlignmentService?: DiffAlignmentService
  ) {
    this.classifierService = classifierService || new ChunkClassifierService();
    this.section6Builder = section6Builder || new Section6BuilderService();
    this.diffAlignmentService = diffAlignmentService || new DiffAlignmentService();
  }

  /**
   * Khởi tạo hoặc lấy ra phiên đồ thị tri thức In-Memory theo Session
   */
  public getOrCreateSession(
    sessionId: string,
    documentId?: string
  ): PitchGraphSession {
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = new PitchGraphSession(sessionId, documentId);
      this.sessions.set(sessionId, session);
      this.seedBaselineNodes(session, documentId);
      this.logger.log(
        `[PitchGraphService] Initialized new PitchGraphSession: ${sessionId}`
      );
    }
    return session;
  }

  /**
   * Truy vấn session hiện tại
   */
  public getSession(sessionId: string): PitchGraphSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Giải phóng 100% tài nguyên đồ thị trên RAM khi đóng phiên (Zero Memory Leak)
   */
  public removeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.clear();
      this.sessions.delete(sessionId);
      this.logger.log(
        `[PitchGraphService] Disposed PitchGraphSession: ${sessionId}`
      );
    }
  }

  /**
   * Nạp các Node cơ sở từ bản Word (WORD_BASELINE) để làm mốc đối soát
   */
  private seedBaselineNodes(
    session: PitchGraphSession,
    documentId?: string
  ): void {
    if (!documentId || !this.documentService) return;

    try {
      const doc = this.documentService.getDocument(documentId);
      if (!doc || !doc.sections) return;

      for (const section of doc.sections) {
        const nodeId = randomUUID();
        const safeTitle = section.title?.trim() || section.type || 'Phần cơ sở';
        const safeContent = section.content?.trim() || 'Nội dung cơ sở';
        const node: PitchGraphNode = {
          id: nodeId,
          sessionId: session.sessionId,
          sectionType: (section.type as PitchSectionType) || PitchSectionType.PROBLEM_MARKET,
          category: 'OTHER',
          key: safeTitle,
          value: safeContent.slice(0, 350),
          status: PitchGraphNodeStatus.ACTIVE,
          source: PitchNodeSource.WORD_BASELINE,
          confidence: 1.0,
          sequenceId: 0,
          timestamp: Date.now(),
          originalSentence: safeContent.slice(0, 200),
        };
        session.addNode(node);
      }

      this.logger.log(
        `[PitchGraphService] Seeded ${doc.sections.length} baseline nodes for session ${session.sessionId}`
      );
    } catch (err) {
      this.logger.warn(
        `[PitchGraphService] Could not seed baseline nodes: ${err}`
      );
    }
  }

  /**
   * Nhận Chunk thời gian thực và xử lý tuần tự qua FIFO Promise Queue (AD-2, FR-02)
   */
  public async processStreamPitchChunk(
    payload: C2SStreamPitchChunkPayload
  ): Promise<S2CPitchGraphSyncPayload> {
    const session = this.getOrCreateSession(payload.sessionId);

    // Bắt buộc đẩy vào hàng đợi Promise Queue để triệt tiêu race condition (AD-2)
    return session.enqueueMutation(async () => {
      session.lastSequenceId = payload.sequenceId;
      session.totalChunksCount += 1;

      const rawText = payload.text.trim();
      if (!rawText) {
        return this.getGraphSyncPayload(payload.sessionId);
      }

      const markers = payload.detectedMarkers || [];

      // =========================================================================
      // XỬ LÝ LOGIC TOMBSTONE MUTATION ENGINE (FR-02)
      // =========================================================================
      if (markers.includes(RetractionMarkerType.OVERWRITE_DIRECT)) {
        // Direct Overwrite: Tìm node gần nhất, đánh dấu SUPERSEDED và tạo node mới ACTIVE
        const targetNode =
          session.findMostRecentActiveNode(
            (n) => n.source !== PitchNodeSource.WORD_BASELINE
          ) || session.findMostRecentActiveNode();

        const newNodeId = randomUUID();
        const newNode: PitchGraphNode = {
          id: newNodeId,
          sessionId: session.sessionId,
          sectionType: targetNode
            ? targetNode.sectionType
            : PitchSectionType.PROBLEM_MARKET,
          category: targetNode ? targetNode.category : 'OTHER',
          key: targetNode ? targetNode.key : 'thông_tin_đính_chính',
          value: rawText,
          status: PitchGraphNodeStatus.ACTIVE,
          source: PitchNodeSource.PITCH_REFINED,
          confidence: 1.0,
          sequenceId: payload.sequenceId,
          timestamp: payload.timestamp || Date.now(),
          originalSentence: rawText,
        };

        session.addNode(newNode);

        if (targetNode) {
          session.updateNodeStatus(
            targetNode.id,
            PitchGraphNodeStatus.SUPERSEDED,
            newNodeId
          );
          session.addEdge({
            sourceNodeId: newNodeId,
            targetNodeId: targetNode.id,
            edgeType: PitchGraphEdgeType.REPLACES,
            timestamp: Date.now(),
          });
          this.logger.log(
            `[Tombstone] Node ${targetNode.id} -> SUPERSEDED by ${newNodeId} (OVERWRITE_DIRECT)`
          );
        }
      } else if (markers.includes(RetractionMarkerType.CANCELLATION)) {
        // Cancellation: Hủy bỏ node gần nhất (RETRACTED)
        const targetNode =
          session.findMostRecentActiveNode(
            (n) => n.source !== PitchNodeSource.WORD_BASELINE
          ) || session.findMostRecentActiveNode();

        if (targetNode) {
          session.updateNodeStatus(
            targetNode.id,
            PitchGraphNodeStatus.RETRACTED
          );
          this.logger.log(
            `[Tombstone] Node ${targetNode.id} -> RETRACTED (CANCELLATION)`
          );
        }
      } else if (markers.includes(RetractionMarkerType.ELABORATION)) {
        // Elaboration: Làm rõ node cũ (CLARIFIES edge)
        const targetNode = session.findMostRecentActiveNode();
        const newNodeId = randomUUID();
        const newNode: PitchGraphNode = {
          id: newNodeId,
          sessionId: session.sessionId,
          sectionType: targetNode
            ? targetNode.sectionType
            : PitchSectionType.SOLUTION_PRODUCT,
          category: targetNode ? targetNode.category : 'OTHER',
          key: targetNode ? `${targetNode.key}_chi_tiết` : 'giải_thích_thêm',
          value: rawText,
          status: PitchGraphNodeStatus.ACTIVE,
          source: PitchNodeSource.PITCH_REFINED,
          confidence: 1.0,
          sequenceId: payload.sequenceId,
          timestamp: payload.timestamp || Date.now(),
          originalSentence: rawText,
        };

        session.addNode(newNode);

        if (targetNode) {
          session.addEdge({
            sourceNodeId: newNodeId,
            targetNodeId: targetNode.id,
            edgeType: PitchGraphEdgeType.CLARIFIES,
            timestamp: Date.now(),
          });
        }
      } else {
        // Chunk thông thường: Phân luồng 2 nhánh (Bifurcated Routing) & Whitelist Gate (FR-04)
        const baselineNodes = session.getActiveNodes().filter(
          (n) => n.source === PitchNodeSource.WORD_BASELINE
        );

        const classification = this.classifierService.classifyChunk(
          rawText,
          baselineNodes
        );

        // 1. Nếu là rác hội thoại (chào hỏi, than thở, cảm thán): Bỏ qua triệt để
        if (classification.isNoise) {
          this.logger.debug(
            `[ChunkClassifier] Ignored noise/filler chunk: "${rawText}"`
          );
          return this.getGraphSyncPayload(payload.sessionId);
        }

        const newNodeId = randomUUID();

        // 2. Nhánh 1: Tương đồng >= 65% với Word -> Ghi vào Refined Layer (PITCH_REFINED)
        if (classification.routing === 'REFINED') {
          const newNode: PitchGraphNode = {
            id: newNodeId,
            sessionId: session.sessionId,
            sectionType: classification.sectionType,
            category: classification.category,
            key: this.extractKeySummary(rawText),
            value: rawText,
            status: PitchGraphNodeStatus.ACTIVE,
            source: PitchNodeSource.PITCH_REFINED,
            confidence: classification.similarityScore,
            sequenceId: payload.sequenceId,
            timestamp: payload.timestamp || Date.now(),
            originalSentence: rawText,
          };

          session.addNode(newNode);
          this.logger.log(
            `[ChunkClassifier] Refined Node in Section [${classification.sectionType}]: "${rawText}" (sim=${classification.similarityScore})`
          );
        } else if (classification.routing === 'STAGING') {
          // 3. Nhánh 2: Tương đồng < 65% nhưng thỏa Whitelist -> Đưa vào Staging Buffer
          // LƯU Ý: Khối 6 KHÔNG sinh ra khi đang pitch dở dang; chỉ sinh khi nộp bài (finalize)
          session.addStagingItem({
            sequenceId: payload.sequenceId,
            text: rawText,
            timestamp: payload.timestamp || Date.now(),
            detectedMarkers: markers,
            category: classification.category,
          });

          this.logger.log(
            `[ChunkClassifier] Staged entity in Whitelist [${classification.category}]: "${rawText}"`
          );
        }
        // Nếu routing === 'DISCARDED': Bỏ qua, không đưa vào Staging Buffer
      }

      return this.getGraphSyncPayload(payload.sessionId);
    });
  }

  /**
   * Khóa bài thuyết trình và hoàn tất đồ thị In-Memory (FR-03 & FR-05)
   */
  public async finalizePitchStream(
    payload: C2SFinalizePitchStreamPayload
  ): Promise<S2CPitchGraphSyncPayload> {
    const session = this.getOrCreateSession(payload.sessionId);

    return session.enqueueMutation(async () => {
      session.isFinalized = true;
      session.fullRawTranscript = payload.fullRawTranscript;
      session.durationSeconds = payload.durationSeconds;
      session.totalChunksCount = payload.totalChunks;

      // 1. Chạy Single-Pass Diff Alignment bù các chunk bị rớt mạng trong <= 400ms (FR-03)
      if (payload.fullRawTranscript) {
        await this.diffAlignmentService.align(
          session,
          payload.fullRawTranscript,
          this.classifierService
        );
      }

      // 2. Khai sinh Khối thứ 6 (nếu có staging) và phát hiện bẻ lái chiến lược (> 80% lệch Word)
      const baselineCount = Array.from(session.nodes.values()).filter(
        (n) => n.source === PitchNodeSource.WORD_BASELINE
      ).length;

      this.section6Builder.materializeSection6(session, baselineCount);

      this.logger.log(
        `[PitchGraphService] Finalized pitch stream for session ${payload.sessionId}: ` +
          `${session.totalChunksCount} chunks, ${session.getActiveNodes().length} active nodes, ` +
          `hasSection6=${session.hasSection6}, isPivotDetected=${session.isPivotDetected}`
      );

      return this.getGraphSyncPayload(payload.sessionId);
    });
  }

  /**
   * Đồng bộ trạng thái đồ thị và Khối thứ 6 về Client
   */
  public getGraphSyncPayload(sessionId: string): S2CPitchGraphSyncPayload {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return {
        sessionId,
        activeNodesCount: 0,
        refinedNodesCount: 0,
        hasSection6: false,
        section6EntitiesCount: 0,
        isPivotDetected: false,
        timestamp: Date.now(),
      };
    }

    const activeNodes = session.getActiveNodes();
    const refinedNodes = session.getRefinedNodes();

    return {
      sessionId,
      activeNodesCount: activeNodes.length,
      refinedNodesCount: refinedNodes.length,
      hasSection6: session.hasSection6,
      section6Title: session.section6Title,
      section6EntitiesCount: session.stagingBuffer.length,
      isPivotDetected: session.isPivotDetected,
      timestamp: Date.now(),
    };
  }

  /**
   * Heuristic phân loại sơ bộ Business Whitelist Category
   */
  private heuristicClassifyCategory(
    text: string
  ): BusinessWhitelistCategory | 'OTHER' {
    const lower = text.toLowerCase();
    if (
      /(?:doanh\s*thu|lợi\s*nhuận|định\s*giá|triệu|tỷ|usd|vnd|chi\s*phí|hòa\s*vốn|\d+[\.,]?\d*\s*%)/i.test(
        lower
      )
    ) {
      return BusinessWhitelistCategory.FINANCIAL_METRIC;
    }
    if (
      /(?:thị\s*trường|khách\s*hàng|địa\s*bàn|quốc\s*gia|khu\s*vực|mở\s*rộng|đông\s*nam\s*á)/i.test(
        lower
      )
    ) {
      return BusinessWhitelistCategory.MARKET_EXPANSION;
    }
    if (
      /(?:tính\s*năng|công\s*nghệ|thuật\s*toán|nền\s*tảng|phần\s*mềm|mô\s*hình\s*ai|giải\s*pháp)/i.test(
        lower
      )
    ) {
      return BusinessWhitelistCategory.NEW_FEATURE;
    }
    if (
      /(?:đối\s*tác|kênh\s*bán|đại\s*lý|phân\s*phối|hợp\s*tác|liên\s*kết)/i.test(
        lower
      )
    ) {
      return BusinessWhitelistCategory.CHANNEL_PARTNER;
    }
    if (
      /(?:lộ\s*trình|mốc|tháng\s*\d+|quý\s*\d+|năm\s*\d+|ra\s*mắt|triển\s*khai)/i.test(
        lower
      )
    ) {
      return BusinessWhitelistCategory.TIMELINE_ROADMAP;
    }
    return 'OTHER';
  }

  /**
   * Heuristic xác định đề mục đồ thị
   */
  private heuristicSectionType(text: string): PitchSectionType {
    const lower = text.toLowerCase();
    if (/(?:vấn\s*đề|nỗi\s*đau|nhu\s*cầu|thị\s*trường)/i.test(lower)) {
      return PitchSectionType.PROBLEM_MARKET;
    }
    if (/(?:giải\s*pháp|sản\s*phẩm|công\s*nghệ|tính\s*năng)/i.test(lower)) {
      return PitchSectionType.SOLUTION_PRODUCT;
    }
    if (/(?:mô\s*hình|doanh\s*thu|giá|bán|chi\s*phí)/i.test(lower)) {
      return PitchSectionType.BUSINESS_MODEL_UNIT_ECONOMICS;
    }
    if (/(?:đối\s*thủ|cạnh\s*tranh|lợi\s*thế|khác\s*biệt)/i.test(lower)) {
      return PitchSectionType.COMPETITION_MOAT;
    }
    if (/(?:lộ\s*trình|tác\s*động|xã\s*hội|tương\s*lai)/i.test(lower)) {
      return PitchSectionType.SOCIAL_IMPACT_ROADMAP;
    }
    return PitchSectionType.DYNAMIC_EXPANDED_SCOPE;
  }

  private extractKeySummary(text: string): string {
    const words = text.split(/\s+/).filter(Boolean);
    return words.slice(0, 5).join(' ');
  }
}
