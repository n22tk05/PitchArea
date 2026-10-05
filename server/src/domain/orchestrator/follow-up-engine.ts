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
   * Quyết định bước tiếp theo: Đào sâu thêm lần 2 hay Chuyển sang Coaching Pivot (Strike 2)
   */
  public decideNextMove(
    currentFollowUpCount: number,
    currentTopic: string,
    evaluation: CandidateAnswerEvaluation,
    currentBossId: JuryBossId
  ): FollowUpDecision {
    // Nếu thí sinh trả lời yếu / lảng tránh:
    if (evaluation.isVague) {
      if (currentFollowUpCount === 0) {
        // Lần 1: Bới sâu thêm 1 tầng nữa
        this.logger.log(`[FollowUpEngine] Strike 1 on topic "${currentTopic}" -> FOLLOW_UP_DEEP`);
        return {
          action: 'FOLLOW_UP_DEEP',
          topic: currentTopic,
          followUpCount: 1,
          reason: 'Thí sinh trả lời còn chung chung, thiếu số liệu định lượng.',
          suggestedBossId: currentBossId,
        };
      } else if (currentFollowUpCount >= 1) {
        // Lần 2 liên tiếp bối rối ở cùng chủ đề -> Kích hoạt Coaching Pivot
        this.logger.log(`[FollowUpEngine] Strike 2 on topic "${currentTopic}" -> COACHING_PIVOT`);
        return {
          action: 'COACHING_PIVOT',
          topic: currentTopic,
          followUpCount: currentFollowUpCount + 1,
          reason: 'Thí sinh 2 lần liên tiếp gặp khó khăn ở cùng chủ đề. Chuyển sang gợi ý sư phạm.',
          suggestedBossId: currentBossId,
        };
      }
    }

    // Nếu trả lời tốt, chuyển sang câu hỏi hoặc chủ đề mới luân phiên
    return {
      action: 'NEW_QUESTION',
      topic: this.rotateTopic(currentTopic),
      followUpCount: 0,
      reason: 'Thí sinh đã giải trình tương đối rõ ràng hoặc chuyển chủ đề mới.',
      suggestedBossId: this.rotateBoss(currentBossId),
    };
  }

  private rotateTopic(currentTopic: string): string {
    const topics = [
      'Unit Economics & Chi phí vận hành',
      'Kiến trúc dự phòng kỹ thuật & Latency LLM',
      'Rào cản độc quyền Moat & Go-to-Market',
      'Định giá & Thời gian thu hồi vốn',
    ];
    const currentIndex = topics.indexOf(currentTopic);
    const nextIndex = (currentIndex + 1) % topics.length;
    return topics[nextIndex];
  }

  private rotateBoss(currentBossId: JuryBossId): JuryBossId {
    if (currentBossId === JuryBossId.FINANCE_DRAGON) {
      return JuryBossId.TECH_SENTINEL;
    } else if (currentBossId === JuryBossId.TECH_SENTINEL) {
      return JuryBossId.MARKET_SHARK;
    } else {
      return JuryBossId.FINANCE_DRAGON;
    }
  }
}
