import { Injectable, Logger } from '@nestjs/common';
import { streamText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { JuryBossId } from '@pitcharena/shared';
import {
  BOSS_PERSONAS,
  buildCoachingPivotPrompt,
  buildQuestionPrompt,
} from './prompt-templates';

export interface StreamQuestionOptions {
  bossId: JuryBossId;
  ragContext: string;
  candidateSpeech: string;
  isFollowUp?: boolean;
  followUpTopic?: string;
  isCoachingPivot?: boolean;
  candidateHistory?: string;
  onChunk: (chunk: string) => void;
  onComplete: (fullText: string) => void;
  onError?: (err: any) => void;
}

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);

  /**
   * Stream câu hỏi của Giám khảo AI (Hỗ trợ luân chuyển Gemini & Groq)
   */
  public async streamBossQuestion(options: StreamQuestionOptions): Promise<string> {
    const {
      bossId,
      ragContext,
      candidateSpeech,
      isFollowUp,
      followUpTopic,
      isCoachingPivot,
      candidateHistory,
      onChunk,
      onComplete,
      onError,
    } = options;

    const persona = BOSS_PERSONAS[bossId] || BOSS_PERSONAS[JuryBossId.FINANCE_DRAGON];
    const geminiKey =
      process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;

    // Chuẩn bị Prompt
    let prompt: string;
    if (isCoachingPivot && followUpTopic) {
      prompt = buildCoachingPivotPrompt(
        persona,
        followUpTopic,
        candidateHistory || candidateSpeech
      );
    } else {
      prompt = buildQuestionPrompt(
        persona,
        ragContext,
        candidateSpeech,
        isFollowUp,
        followUpTopic
      );
    }

    // 1. ƯU TIÊN GROQ (openai/gpt-oss-120b) nếu có GROQ_API_KEY (Siêu tốc >250 tokens/s, không bị giới hạn 20 req/ngày)
    if (groqKey) {
      this.logger.log(
        `[GroqProvider] Kích hoạt Groq Model: openai/gpt-oss-120b stream trực tiếp...`
      );
      try {
        const groq = createOpenAI({
          baseURL: 'https://api.groq.com/openai/v1',
          apiKey: groqKey,
        });

        const result = streamText({
          model: groq.chat('openai/gpt-oss-120b'),
          prompt,
          temperature: 0.7,
        });

        let accumulated = '';
        for await (const textPart of result.textStream) {
          accumulated += textPart;
          onChunk(textPart);
        }
        console.log(accumulated);
        onComplete(accumulated);
        return accumulated;
      } catch (groqErr: any) {
        this.logger.error(
          `[GroqProvider] Lỗi khi gọi Groq API (${groqErr.message}). Chuyển sang Gemini dự phòng.`
        );
      }
    }

    // 2. Dự phòng Google Gemini (gemini-3.6-flash) nếu không có Groq hoặc Groq lỗi
    if (geminiKey) {
      this.logger.log(`[GeminiService] Đang gọi Google Gemini API stream câu hỏi...`);
      try {
        const googleProvider = createGoogleGenerativeAI({ apiKey: geminiKey });
        const result = streamText({
          model: googleProvider('gemini-3.6-flash'),
          prompt,
          temperature: 0.7,
          maxRetries: 0, // Không retry để tránh bị treo khi hết quota 8 tiếng
        });

        let accumulated = '';
        for await (const textPart of result.textStream) {
          accumulated += textPart;
          onChunk(textPart);
        }
        console.log(accumulated);
        onComplete(accumulated);
        return accumulated;
      } catch (err: any) {
        this.logger.warn(
          `[GeminiService] Gemini API gặp vấn đề (${err.message}). Kích hoạt Fallback nội bộ.`
        );
      }
    }

    // Smart Fallback nếu không có API key hoặc mạng gián đoạn
    return this.fallbackStreamQuestion(
      persona,
      followUpTopic,
      isCoachingPivot,
      onChunk,
      onComplete
    );
  }

  /**
   * Giả lập stream fallback câu hỏi từng từ tốc độ cao (~30ms/word) khi offline
   */
  private async fallbackStreamQuestion(
    persona: any,
    topic?: string,
    isCoaching?: boolean,
    onChunk?: (c: string) => void,
    onComplete?: (t: string) => void
  ): Promise<string> {
    let fallbackText = '';

    if (isCoaching) {
      fallbackText = `Tôi hiểu đây là bài toán khó khi làm sản phẩm thực tế. Một hướng tiếp cận khả thi là bạn có thể áp dụng caching kết hợp batch inference để cắt giảm 70% chi phí API. Bạn thấy giải pháp phân kỳ này có thể áp dụng cho giai đoạn MVP của dự án không?`;
    } else if (persona.id === JuryBossId.FINANCE_DRAGON) {
      fallbackText = `Trong tài liệu, bạn công bố CAC là 3.2 triệu và LTV 48 triệu VNĐ. Tuy nhiên với mô hình LLM API chạy real-time cho hàng trăm người dùng, chi phí suy luận ước tính ngốn hơn 50% biên lợi nhuận. Bạn dự phòng dòng tiền cạn kiệt trong 6 tháng đầu thế nào?`;
    } else if (persona.id === JuryBossId.TECH_SENTINEL) {
      fallbackText = `Hệ thống của bạn phụ thuộc hoàn toàn vào API LLM bên thứ ba. Trong trường hợp nhà cung cấp quá tải hoặc độ trễ tăng đột biến lên trên 3 giây, cơ chế fallback tại chỗ của bạn là gì để không làm đứt gãy trải nghiệm người dùng?`;
    } else {
      fallbackText = `Thị trường giải pháp này hiện có ít nhất 3 đối thủ lớn với tiềm lực tài chính gấp 20 lần bạn. Rào cản công nghệ hay tính năng độc quyền (Moat) thực sự của bạn là gì để ngăn họ sao chép sản phẩm trong vòng 3 tháng?`;
    }

    const words = fallbackText.split(' ');
    let current = '';

    for (let i = 0; i < words.length; i++) {
      const part = (i === 0 ? '' : ' ') + words[i];
      current += part;
      if (onChunk) onChunk(part);
      await new Promise((r) => setTimeout(r, 25)); // Giả lập độ trễ gõ phím mượt mà
    }

    if (onComplete) onComplete(current);
    return current;
  }
}
