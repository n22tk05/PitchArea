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
      'So sánh với cách làm truyền thống & Rào cản thay đổi thói quen người dùng',
      'Điểm khác biệt cốt lõi so với các giải pháp và công cụ hiện có trên thị trường',
      'Logic lựa chọn phân khúc khách hàng & Lý do họ chọn bạn thay vì đối thủ',
      'Hành trình trải nghiệm thực tế từ tiếp cận đến sử dụng thành thạo',
      'Nhu cầu cấp bách thực tế & Bằng chứng kiểm chứng sự vượt trội',
    ],
    [JuryBossId.TECH_SENTINEL]: [
      'Logic hoạt động & Luồng xử lý dữ liệu chi tiết (Input -> Xử lý logic -> Output)',
      'Cơ chế thuật toán cốt lõi & Điểm đột phá kỹ thuật so với công cụ thông thường',
      'Khả năng tích hợp vào hệ thống/thiết bị sẵn có & Yêu cầu hạ tầng triển khai',
      'Kiểm thử thực tế, an toàn bảo mật dữ liệu & Độ tin cậy hệ thống',
      'Kiến trúc hệ thống, độ trễ phản hồi & Khả năng mở rộng khi lượng truy cập tăng',
    ],
    [JuryBossId.FINANCE_DRAGON]: [
      'Giá trị kinh tế cụ thể mang lại cho người dùng so với chi phí họ bỏ ra',
      'Cơ sở xác định giá bán & Tính khả thi của mô hình doanh thu',
      'Chi phí vận hành hệ thống hàng tháng & Khả năng tự duy trì của dự án',
      'Kế hoạch tài chính triển khai giai đoạn đầu & Điểm hòa vốn thực tế',
      'Định mức chi tiêu nguồn vốn & Hiệu quả sử dụng kinh phí đầu tư',
    ],
    [JuryBossId.RISK_STRATEGIST]: [
      'Rào cản phòng thủ: Điểm khác biệt ngăn đối thủ lớn sao chép giải pháp',
      'So sánh thế mạnh cạnh tranh trực diện và điểm yếu chí mạng của dự án',
      'Lộ trình triển khai 6-12 tháng & Các mốc kiểm chứng kỹ thuật quan trọng',
      'Rủi ro pháp lý, bản quyền sở hữu trí tuệ & Đạo đức dữ liệu',
      'Năng lực cam kết đường dài của đội ngũ & Kế hoạch ứng phó biến động thị trường',
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
   * Lấy ngẫu nhiên một chủ đề đa dạng phù hợp chuyên môn của Giám khảo
   */
  public getRandomTopicForBoss(bossId: JuryBossId, excludeTopic?: string): string {
    const topics = FollowUpEngine.BOSS_TOPICS[bossId] || ['Định hướng phát triển dự án'];
    const candidates = topics.filter((t) => t !== excludeTopic);
    const pool = candidates.length > 0 ? candidates : topics;
    const randomIndex = Math.floor(Math.random() * pool.length);
    return pool[randomIndex];
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
    isCurrentCoachingPivot = false,
    mode?: string
  ): FollowUpDecision {
    // Trong chế độ Hội đồng đầy đủ (FULL_ARENA):
    // Luôn luân phiên đổi Giám khảo qua từng lượt để mô phỏng chân thực Hội đồng chấm thi
    // (từng thầy cô lần lượt đặt câu hỏi từ các góc độ khác nhau: Thị trường -> Công nghệ -> Tài chính -> Rủi ro)
    const nextBoss = this.rotateBoss(currentBossId, availableBossIds);
    const nextTopic = this.rotateTopicForBoss(nextBoss, currentTopic);

    // Nếu thí sinh 2 lần liên tiếp bị đuối lý ở cùng một mảng (Coaching Pivot):
    if (isCurrentCoachingPivot || currentFollowUpCount >= 2) {
      this.logger.log(
        `[FollowUpEngine] Completed coaching/follow-up cycle. Rotating to new boss: ${nextBoss} with topic: "${nextTopic}"`
      );
      return {
        action: 'NEW_QUESTION',
        topic: nextTopic,
        followUpCount: 0,
        reason: 'Đã hoàn thành vòng gợi ý sư phạm. Chuyển sang Giám khảo tiếp theo trong Hội đồng.',
        suggestedBossId: nextBoss,
      };
    }

    // Nếu chỉ có đúng 1 Boss (ví dụ chế độ Solo/Quick Combat hoặc chỉ có 1 đề mục)
    // thì mới bới sâu cùng 1 Boss
    if (availableBossIds && availableBossIds.length === 1) {
      if (evaluation.isVague) {
        if (currentFollowUpCount === 0) {
          return {
            action: 'FOLLOW_UP_DEEP',
            topic: currentTopic,
            followUpCount: 1,
            reason: 'Thí sinh trả lời còn chung chung, thiếu số liệu định lượng.',
            suggestedBossId: currentBossId,
          };
        } else if (currentFollowUpCount === 1) {
          return {
            action: 'COACHING_PIVOT',
            topic: currentTopic,
            followUpCount: 2,
            reason: 'Thí sinh 2 lần liên tiếp gặp khó khăn ở cùng chủ đề. Chuyển sang gợi ý sư phạm.',
            suggestedBossId: currentBossId,
          };
        }
      }
    }

    // MẶC ĐỊNH HỘI ĐỒNG (FULL ARENA):
    // Sau mỗi câu trả lời của thí sinh, Giám khảo tiếp theo sẽ tiếp quản micro để hỏi theo chuyên môn riêng!
    this.logger.log(
      `[FollowUpEngine] Hội đồng chuyển micro từ [${currentBossId}] sang [${nextBoss}] (Chủ đề mới: "${nextTopic}")`
    );

    return {
      action: 'NEW_QUESTION',
      topic: nextTopic,
      followUpCount: 0,
      reason: 'Chuyển lượt cho Giám khảo tiếp theo trong Hội đồng chất vấn.',
      suggestedBossId: nextBoss,
    };
  }

  private rotateTopicForBoss(bossId: JuryBossId, currentTopic?: string): string {
    return this.getRandomTopicForBoss(bossId, currentTopic);
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
