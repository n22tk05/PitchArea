import { Injectable, Logger } from '@nestjs/common';
import { JuryBossId } from '@pitcharena/shared';

export interface FollowUpDecision {
  action: 'NEW_QUESTION' | 'FOLLOW_UP_DEEP' | 'COACHING_PIVOT';
  topic: string;
  followUpCount: number;
  reason: string;
  suggestedBossId: JuryBossId;
}

export interface CandidateAnswerEvaluation {
  isVague: boolean;
  isDefensive: boolean;
  hasNumbers: boolean;
  wordCount: number;
}

@Injectable()
export class FollowUpEngine {
  private readonly logger = new Logger(FollowUpEngine.name);

  /**
   * Đánh giá sơ bộ câu trả lời của thí sinh (Heuristic Evaluation)
   */
  public evaluateCandidateSpeech(speech: string): CandidateAnswerEvaluation {
    const trimmed = speech.trim();
    const words = trimmed.split(/\s+/).filter(Boolean);
    const wordCount = words.length;

    // Kiểm tra có chứa số liệu hay không
    const hasNumbers = /\d+/.test(trimmed);

    // Dấu hiệu trả lời lảng tránh/chung chung: quá ngắn (< 15 từ) hoặc chứa từ ngữ do dự
    const vagueKeywords = [
      'chưa tính',
      'chưa rõ',
      'đang tìm hiểu',
      'chắc là',
      'có lẽ',
      'khoảng khoảng',
      'tùy thuộc',
      'chưa có số liệu',
    ];
    const isVague =
      wordCount < 15 ||
      vagueKeywords.some((kw) => trimmed.toLowerCase().includes(kw)) ||
      (!hasNumbers && wordCount < 30);

    const isDefensive =
      trimmed.toLowerCase().includes('nhưng mà') ||
      trimmed.toLowerCase().includes('không đồng ý');

    return {
      isVague,
      isDefensive,
      hasNumbers,
      wordCount,
    };
  }

  /**
   * Bảng ánh xạ chủ đề chuyên môn mặc định cho từng Giám khảo (4 Nhóm Trụ Cột)
   */
  public static readonly BOSS_TOPICS: Record<JuryBossId, string[]> = {
    [JuryBossId.MARKET_SHARK]: [
      'Nỗi đau khách hàng & Cơ sở khảo sát thực tế',
      'Chân dung khách hàng mục tiêu & Mức độ sẵn sàng chi trả',
      'Quy mô thị trường có thể tiếp cận & Kế hoạch bán hàng',
    ],
    [JuryBossId.TECH_SENTINEL]: [
      'Kiến trúc hệ thống & Độ trễ phản hồi',
      'Tính ổn định của MVP & Xử lý khi AI sai lệch',
      'Khả năng mở rộng quy mô (Scalability) & Chi phí máy chủ',
    ],
    [JuryBossId.FINANCE_DRAGON]: [
      'Bài toán giá bán & Chi phí sản xuất trên từng sản phẩm',
      'Chi phí tìm kiếm khách hàng & Điểm hòa vốn',
      'Dòng tiền thực tế & Nguồn kinh phí duy trì đội ngũ',
    ],
    [JuryBossId.RISK_STRATEGIST]: [
      'Rủi ro cạnh tranh & Điểm khác biệt trước đối thủ lớn',
      'Vũ khí độc quyền giữ chân khách hàng (Moat) & Pháp lý',
      'Lộ trình triển khai 6-12 tháng & Cột mốc kiểm chứng',
    ],
  };

  /**
   * Lấy chủ đề mặc định phù hợp với chuyên môn của từng Giám khảo
   */
  public getDefaultTopicForBoss(bossId: JuryBossId): string {
    const topics = FollowUpEngine.BOSS_TOPICS[bossId];
    return topics && topics.length > 0 ? topics[0] : 'Định hướng phát triển dự án';
  }

  /**
   * Quyết định bước tiếp theo: Đào sâu thêm lần 2 hay Chuyển sang Coaching Pivot (Strike 2)
   */
  public decideNextMove(
    currentFollowUpCount: number,
    currentTopic: string,
    evaluation: CandidateAnswerEvaluation,
    currentBossId: JuryBossId,
    availableBossIds?: JuryBossId[],
    isCurrentCoachingPivot = false
  ): FollowUpDecision {
    // Nếu lượt vừa qua ĐÃ là Coaching Pivot (thí sinh đã nhận hướng dẫn sư phạm),
    // lượt tiếp theo bắt buộc phải chuyển sang câu hỏi mới và đổi Giám khảo, không được kẹt lại.
    if (isCurrentCoachingPivot || currentFollowUpCount >= 2) {
      const nextBoss = this.rotateBoss(currentBossId, availableBossIds);
      const nextTopic = this.rotateTopicForBoss(nextBoss, currentTopic);
      this.logger.log(
        `[FollowUpEngine] Completed coaching/follow-up cycle. Rotating to new boss: ${nextBoss} with topic: "${nextTopic}"`
      );
      return {
        action: 'NEW_QUESTION',
        topic: nextTopic,
        followUpCount: 0,
        reason: 'Đã hoàn thành vòng gợi ý sư phạm/follow-up. Chuyển sang Giám khảo và chủ đề tiếp theo.',
        suggestedBossId: nextBoss,
      };
    }

    // Nếu thí sinh trả lời yếu / lảng tránh:
    if (evaluation.isVague) {
      if (currentFollowUpCount === 0) {
        // Lần 1: Bới sâu thêm 1 tầng nữa (cùng Boss, cùng Topic)
        this.logger.log(`[FollowUpEngine] Strike 1 on topic "${currentTopic}" -> FOLLOW_UP_DEEP`);
        return {
          action: 'FOLLOW_UP_DEEP',
          topic: currentTopic,
          followUpCount: 1,
          reason: 'Thí sinh trả lời còn chung chung, thiếu số liệu định lượng.',
          suggestedBossId: currentBossId,
        };
      } else if (currentFollowUpCount === 1) {
        // Lần 2 liên tiếp bối rối ở cùng chủ đề -> Kích hoạt Coaching Pivot
        this.logger.log(`[FollowUpEngine] Strike 2 on topic "${currentTopic}" -> COACHING_PIVOT`);
        return {
          action: 'COACHING_PIVOT',
          topic: currentTopic,
          followUpCount: 2,
          reason: 'Thí sinh 2 lần liên tiếp gặp khó khăn ở cùng chủ đề. Chuyển sang gợi ý sư phạm.',
          suggestedBossId: currentBossId,
        };
      }
    }

    // Nếu trả lời tốt hoặc không bị bối rối, chuyển sang câu hỏi mới và đổi Giám khảo luân phiên
    const nextBoss = this.rotateBoss(currentBossId, availableBossIds);
    const nextTopic = this.rotateTopicForBoss(nextBoss, currentTopic);
    return {
      action: 'NEW_QUESTION',
      topic: nextTopic,
      followUpCount: 0,
      reason: 'Thí sinh đã giải trình tương đối rõ ràng. Chuyển sang Giám khảo và chủ đề mới.',
      suggestedBossId: nextBoss,
    };
  }

  private rotateTopicForBoss(bossId: JuryBossId, currentTopic?: string): string {
    const topics = FollowUpEngine.BOSS_TOPICS[bossId] || [
      'Định hướng phát triển dự án',
    ];
    if (!currentTopic) {
      return topics[0];
    }
    const currentIndex = topics.indexOf(currentTopic);
    if (currentIndex === -1) {
      return topics[0];
    }
    const nextIndex = (currentIndex + 1) % topics.length;
    return topics[nextIndex];
  }

  private rotateBoss(currentBossId: JuryBossId, availableBossIds?: JuryBossId[]): JuryBossId {
    const allowed =
      availableBossIds && availableBossIds.length > 0
        ? availableBossIds
        : Object.values(JuryBossId);

    if (allowed.length === 1) {
      return allowed[0];
    }

    const currentIndex = allowed.indexOf(currentBossId);
    if (currentIndex === -1) {
      return allowed[0];
    }
    const nextIndex = (currentIndex + 1) % allowed.length;
    return allowed[nextIndex];
  }
}
