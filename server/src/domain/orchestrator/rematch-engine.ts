import { Injectable, Logger } from '@nestjs/common';

/**
 * Động cơ Quản lý Tái đấu Nhanh (Quick Re-match Engine)
 * Lưu trữ lịch sử câu hỏi của phiên trước và kiểm tra độ tương đồng ngữ nghĩa/từ vựng (ngưỡng >= 80%)
 * để bảo đảm 100% câu hỏi trong trận tái đấu không bị lặp lại góc hỏi cũ.
 */
@Injectable()
export class RematchEngine {
  private readonly logger = new Logger(RematchEngine.name);

  // Map lưu danh sách câu hỏi đã hỏi theo documentId: Map<documentId, Set<string>>
  private readonly askedQuestionsByDoc = new Map<string, Set<string>>();

  /**
   * Đăng ký danh sách các câu hỏi đã xuất hiện trong phiên vừa kết thúc
   */
  public recordQuestions(documentId: string, questions: string[]) {
    if (!documentId || !questions || questions.length === 0) return;

    if (!this.askedQuestionsByDoc.has(documentId)) {
      this.askedQuestionsByDoc.set(documentId, new Set<string>());
    }

    const set = this.askedQuestionsByDoc.get(documentId)!;
    questions.forEach((q) => {
      const clean = q.trim();
      if (clean.length > 5) {
        set.add(clean);
      }
    });

    this.logger.log(
      `[RematchEngine] Đã ghi nhận ${questions.length} câu hỏi cho tài liệu [${documentId}]. Tổng kho câu hỏi đã hỏi: ${set.size}`
    );
  }

  /**
   * Lấy toàn bộ danh sách câu hỏi đã từng hỏi của tài liệu
   */
  public getPreviousQuestions(documentId: string): string[] {
    const set = this.askedQuestionsByDoc.get(documentId);
    return set ? Array.from(set) : [];
  }

  /**
   * Xóa lịch sử câu hỏi của tài liệu (khi nạp tài liệu mới)
   */
  public clearHistory(documentId: string) {
    this.askedQuestionsByDoc.delete(documentId);
  }

  /**
   * Kiểm tra xem câu hỏi mới có bị trùng lặp (>= 80% similarity) với bất kỳ câu hỏi cũ nào không
   */
  public isQuestionTooSimilar(
    documentId: string,
    newQuestion: string,
    threshold = 0.8
  ): { isDuplicate: boolean; similarity: number; matchedQuestion?: string } {
    const previous = this.getPreviousQuestions(documentId);
    if (previous.length === 0) {
      return { isDuplicate: false, similarity: 0 };
    }

    const newTokens = this.tokenize(newQuestion);
    if (newTokens.length === 0) {
      return { isDuplicate: false, similarity: 0 };
    }

    let maxSim = 0;
    let mostSimilar: string | undefined;

    for (const oldQ of previous) {
      const oldTokens = this.tokenize(oldQ);
      const sim = this.calculateJaccardSimilarity(newTokens, oldTokens);

      if (sim > maxSim) {
        maxSim = sim;
        mostSimilar = oldQ;
      }

      if (sim >= threshold) {
        this.logger.warn(
          `[RematchEngine] ⚠️ Phát hiện câu hỏi trùng lặp (${(sim * 100).toFixed(1)}% >= ${threshold * 100}%): "${newQuestion.slice(0, 60)}..." vs cũ: "${oldQ.slice(0, 60)}..."`
        );
        return { isDuplicate: true, similarity: sim, matchedQuestion: oldQ };
      }
    }

    return {
      isDuplicate: false,
      similarity: maxSim,
      matchedQuestion: mostSimilar,
    };
  }

  /**
   * Tách từ chuẩn hóa tiếng Việt (Tokenize)
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 2);
  }

  /**
   * Tính độ tương đồng Jaccard giữa hai tập hợp từ
   */
  private calculateJaccardSimilarity(tokensA: string[], tokensB: string[]): number {
    const setA = new Set(tokensA);
    const setB = new Set(tokensB);

    if (setA.size === 0 && setB.size === 0) return 1;
    if (setA.size === 0 || setB.size === 0) return 0;

    let intersectionCount = 0;
    setA.forEach((token) => {
      if (setB.has(token)) {
        intersectionCount++;
      }
    });

    const unionCount = setA.size + setB.size - intersectionCount;
    return unionCount === 0 ? 0 : intersectionCount / unionCount;
  }
}
