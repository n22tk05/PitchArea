import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  BusinessWhitelistCategory,
  PitchGraphNode,
  PitchGraphNodeStatus,
  PitchNodeSource,
  PitchSectionType,
} from '@pitcharena/shared';
import { PitchGraphSession } from './pitch-graph-session';

export interface Section6MaterializationResult {
  hasSection6: boolean;
  section6Title?: string;
  section6EntitiesCount: number;
  isPivotDetected: boolean;
  materializedNodes: PitchGraphNode[];
}

@Injectable()
export class Section6BuilderService {
  private readonly logger = new Logger(Section6BuilderService.name);

  // Ngưỡng phát hiện bẻ lái lớn (FR-05: > 80% phát biểu lệch khỏi bản Word)
  public static readonly PIVOT_DEVIATION_THRESHOLD = 0.8;

  /**
   * Khai sinh Khối thứ 6 (DYNAMIC_EXPANDED_SCOPE) và xác định cờ Pivot
   * CHỈ ĐƯỢC GỌI KHI NHẬN SỰ KIỆN KẾT THÚC THUYẾT TRÌNH (finalizePitchStream)
   */
  public materializeSection6(
    session: PitchGraphSession,
    baselineNodesCount: number = 5
  ): Section6MaterializationResult {
    // 0. Idempotency guard: Nếu session đã khai sinh Khối 6 trước đó, không sinh lại
    if (session.hasSection6) {
      const existingS6Nodes = session
        .getActiveNodes()
        .filter((n) => n.sectionType === PitchSectionType.DYNAMIC_EXPANDED_SCOPE);

      return {
        hasSection6: true,
        section6Title: session.section6Title,
        section6EntitiesCount: existingS6Nodes.length,
        isPivotDetected: session.isPivotDetected,
        materializedNodes: existingS6Nodes,
      };
    }

    const stagingItems = session.getStagingBuffer();

    // 1. Nếu không có phát biểu mở rộng nào hợp lệ -> ABSENT (Không sinh Khối 6)
    if (!stagingItems.length) {
      session.hasSection6 = false;
      session.section6Title = undefined;
      session.isPivotDetected = this.evaluatePivot(session, baselineNodesCount);

      this.logger.log(
        `[Section6BuilderService] Session ${session.sessionId}: Section 6 is ABSENT (no staging entities). Pivot: ${session.isPivotDetected}`
      );

      return {
        hasSection6: false,
        section6EntitiesCount: 0,
        isPivotDetected: session.isPivotDetected,
        materializedNodes: [],
      };
    }

    // 2. Phân tích Category chiếm ưu thế để đặt tiêu đề động cho Khối 6
    const categoryCounts = new Map<string, number>();
    for (const item of stagingItems) {
      const cat = item.category || 'OTHER';
      categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
    }

    let dominantCategory: string = 'OTHER';
    let maxCount = 0;
    for (const [cat, count] of categoryCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        dominantCategory = cat;
      }
    }

    const dynamicTitle = this.resolveSection6Title(dominantCategory);

    // 3. Khai sinh các Node chính thức vào Đồ thị
    const materializedNodes: PitchGraphNode[] = [];

    for (const item of stagingItems) {
      const nodeId = randomUUID();
      const node: PitchGraphNode = {
        id: nodeId,
        sessionId: session.sessionId,
        sectionType: PitchSectionType.DYNAMIC_EXPANDED_SCOPE,
        category: (item.category as BusinessWhitelistCategory) || 'OTHER',
        key: this.extractKeySummary(item.text),
        value: item.text,
        status: PitchGraphNodeStatus.ACTIVE,
        source: PitchNodeSource.PITCH_EXPANDED,
        confidence: 1.0,
        sequenceId: item.sequenceId,
        timestamp: item.timestamp,
        originalSentence: item.text,
      };

      session.addNode(node);
      materializedNodes.push(node);
    }

    // 4. Cập nhật trạng thái session
    session.hasSection6 = true;
    session.section6Title = dynamicTitle;

    // 5. Đánh giá cờ Bẻ lái Đề án (FLAG_MAJOR_PROPOSAL_PIVOT)
    session.isPivotDetected = this.evaluatePivot(session, baselineNodesCount);

    this.logger.log(
      `[Section6BuilderService] Materialized Section 6 for session ${session.sessionId}: ` +
        `Title="${dynamicTitle}", ${materializedNodes.length} nodes, isPivotDetected=${session.isPivotDetected}`
    );

    return {
      hasSection6: true,
      section6Title: dynamicTitle,
      section6EntitiesCount: materializedNodes.length,
      isPivotDetected: session.isPivotDetected,
      materializedNodes,
    };
  }

  /**
   * Đánh giá tỷ lệ lệch (> 80%) giữa bài nói và hồ sơ Word gốc (FR-05)
   */
  public evaluatePivot(
    session: PitchGraphSession,
    baselineNodesCount: number
  ): boolean {
    // Nếu không có node baseline từ Word (baselineNodesCount === 0), không thể kết luận là Pivot
    if (baselineNodesCount === 0) {
      return false;
    }

    const activeNodes = session.getActiveNodes();
    const spokenNodes = activeNodes.filter(
      (n) => n.source !== PitchNodeSource.WORD_BASELINE
    );

    // Nếu thí sinh nói quá ít (< 3 luận điểm), chưa đủ cơ sở kết luận Pivot
    if (spokenNodes.length < 3) {
      return false;
    }

    // 1. Tỷ lệ phát biểu hoàn toàn mở rộng (không liên quan gì đến 5 section Word)
    const expandedNodes = spokenNodes.filter(
      (n) =>
        n.source === PitchNodeSource.PITCH_EXPANDED ||
        n.sectionType === PitchSectionType.DYNAMIC_EXPANDED_SCOPE
    );

    const expandedRatio = expandedNodes.length / spokenNodes.length;

    // 2. Tỷ lệ các phần Word baseline bị đè (SUPERSEDED) hoặc phủ nhận
    const allNodes = Array.from(session.nodes.values());
    const supersededBaselineNodes = allNodes.filter(
      (n) =>
        n.source === PitchNodeSource.WORD_BASELINE &&
        n.status === PitchGraphNodeStatus.SUPERSEDED
    );

    const baselineTotal = Math.max(1, baselineNodesCount);
    const baselineSupersededRatio = supersededBaselineNodes.length / baselineTotal;

    // Kích hoạt cờ Pivot khi >= 80% bài nói là ý tưởng mới ngoài Word HOẶC đa số đề án Word bị phủ nhận
    const isPivot =
      expandedRatio >= Section6BuilderService.PIVOT_DEVIATION_THRESHOLD ||
      baselineSupersededRatio >= Section6BuilderService.PIVOT_DEVIATION_THRESHOLD;

    if (isPivot) {
      this.logger.warn(
        `[Section6BuilderService] [FLAG_MAJOR_PROPOSAL_PIVOT] Detected major pivot for session ${session.sessionId}: ` +
          `expandedRatio=${expandedRatio.toFixed(2)}, baselineSupersededRatio=${baselineSupersededRatio.toFixed(2)}`
      );
    }

    return isPivot;
  }

  /**
   * Đặt tiêu đề Khối 6 tương ứng với chủ đề chiếm ưu thế
   */
  private resolveSection6Title(dominantCategory: string): string {
    switch (dominantCategory) {
      case BusinessWhitelistCategory.MARKET_EXPANSION:
        return 'Khối 6: Chiến Lược Mở Rộng Thị Trường & Khách Hàng Mục Tiêu';
      case BusinessWhitelistCategory.NEW_FEATURE:
        return 'Khối 6: Tính Năng Đột Phá & Nâng Cấp Công Nghệ';
      case BusinessWhitelistCategory.CHANNEL_PARTNER:
        return 'Khối 6: Hệ Sinh Thái Kênh Phân Phối & Đối Tác Chiến Lược';
      case BusinessWhitelistCategory.FINANCIAL_METRIC:
        return 'Khối 6: Dự Phóng Tài Chính & Chỉ Số Tăng Trưởng';
      case BusinessWhitelistCategory.TIMELINE_ROADMAP:
        return 'Khối 6: Lộ Trình Triển Khai & Mốc Phát Triển Mới';
      default:
        return 'Khối 6: Phạm Vi Mở Rộng & Chiến Lược Đột Phá';
    }
  }

  /**
   * Rút trích Key tóm tắt ngắn từ câu phát biểu
   */
  private extractKeySummary(text: string): string {
    const cleaned = text.replace(/^[,\.\-\s]+/, '').trim();
    const words = cleaned.split(/\s+/);
    if (words.length <= 6) return cleaned;
    return `${words.slice(0, 6).join(' ')}...`;
  }
}
