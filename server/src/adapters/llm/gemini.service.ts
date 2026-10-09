import { Injectable, Logger } from '@nestjs/common';
import { streamText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { JuryBossId, EvaluationPreset } from '@pitcharena/shared';
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
  preset?: EvaluationPreset;
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
      preset,
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
        candidateHistory || candidateSpeech,
        preset
      );
    } else {
      prompt = buildQuestionPrompt(
        persona,
        ragContext,
        candidateSpeech,
        isFollowUp,
        followUpTopic,
        preset
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
        onComplete(accumulated);
        return accumulated;
      } catch (groqErr: any) {
        this.logger.warn(
          `[FALLBACK] Groq Provider gap su co: "${groqErr.message}". Chuyen sang Gemini (${geminiKey ? 'API Key hop le' : 'Chua cau hinh'}).`
        );
      }
    }

    // 2. Dự phòng Google Gemini (gemini-3.6-flash) nếu không có Groq hoặc Groq lỗi
    if (geminiKey) {
      this.logger.log(`[GeminiService] Dang stream qua Google Gemini API...`);
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
        onComplete(accumulated);
        return accumulated;
      } catch (err: any) {
        this.logger.warn(
          `[FALLBACK] ⚠️ Google Gemini gặp sự cố: "${err.message}". Tự động kích hoạt Fallback Bước 2: Chuyển sang Smart Offline Fallback Generator.`
        );
      }
    }

    // Smart Fallback nếu không có API key hoặc mạng gián đoạn
    this.logger.warn(
      `[FALLBACK] 🚨 TẤT CẢ AI CLOUD PROVIDERS ĐỀU KHÔNG KHẢ DỤNG. Đang kích hoạt Smart Offline Fallback Stream cho Giám khảo: ${persona.name} (${persona.role}) [Preset: ${preset || 'DEFAULT'}]`
    );

    return this.fallbackStreamQuestion(
      persona,
      followUpTopic,
      isCoachingPivot,
      preset,
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
    preset?: EvaluationPreset,
    onChunk?: (c: string) => void,
    onComplete?: (t: string) => void
  ): Promise<string> {
    this.logger.log(
      `[FALLBACK] 🔄 Đang tạo câu hỏi Fallback mô phỏng cho Giám khảo ${persona.name} | Chủ đề: ${topic || 'Tổng quát'} | Preset: ${preset || 'SV_STARTUP'}`
    );
    let fallbackText = '';

    if (isCoaching) {
      fallbackText =
        preset === EvaluationPreset.SV_STARTUP
          ? `Thầy cô hiểu đây là khó khăn lớn khi sinh viên làm sản phẩm thực tế. Một hướng tiếp cận khả thi là nhóm nên bắt đầu thử nghiệm trong quy mô hẹp tại trường để lấy phản hồi thực tế trước. Các em thấy giải pháp từng bước này có phù hợp với nguồn lực hiện tại của nhóm không?`
          : `Tôi hiểu đây là bài toán khó khi làm sản phẩm thực tế. Một hướng tiếp cận khả thi là bạn có thể áp dụng caching kết hợp batch inference để cắt giảm 70% chi phí API. Bạn thấy giải pháp phân kỳ này có thể áp dụng cho giai đoạn MVP của dự án không?`;
    } else if (persona.id === JuryBossId.MARKET_SHARK) {
      if (preset === EvaluationPreset.SV_STARTUP) {
        fallbackText = `Nhóm đưa ra kết quả từ phiếu khảo sát nhưng chưa có người dùng chi tiền thực tế. Nhóm đã nói chuyện trực tiếp với bao nhiêu khách hàng tiềm năng và bằng chứng nào cho thấy họ sẵn sàng bỏ tiền mua sản phẩm này?`;
      } else {
        fallbackText = `Khách hàng hiện tại đang quen với các cách làm truyền thống. Lý do thực tế và cấp bách nhất nào khiến họ chấp nhận thay đổi thói quen và trả tiền sử dụng giải pháp của nhóm ngay trong tháng đầu tiên?`;
      }
    } else if (persona.id === JuryBossId.TECH_SENTINEL) {
      if (preset === EvaluationPreset.SV_STARTUP) {
        fallbackText = `Sản phẩm mẫu MVP của nhóm hiện tại đã chạy thực tế được những tính năng cốt lõi nào? Khi có hàng trăm sinh viên cùng truy cập một lúc, nhóm làm sao để giữ hệ thống không bị chậm hoặc sập máy chủ?`;
      } else {
        fallbackText = `Hệ thống của bạn có độ trễ đo đạc thực tế là bao nhiêu giây? Nếu mô hình AI gặp sự cố trả lời sai lệch thông tin nghiêm trọng, kiến trúc của bạn có phương án dự phòng tại chỗ nào để bảo vệ người dùng?`;
      }
    } else if (persona.id === JuryBossId.FINANCE_DRAGON) {
      if (preset === EvaluationPreset.SV_STARTUP) {
        fallbackText = `Mức giá bán dự kiến cho mỗi sản phẩm là bao nhiêu tiền, và sau khi trừ chi phí sản xuất nhóm lãi được bao nhiêu? Với nguồn vốn sinh viên hạn hẹp, số tiền hiện có đủ duy trì hoạt động trong mấy tháng?`;
      } else {
        fallbackText = `Chi phí thực tế để nhóm có được một khách hàng trả tiền là bao nhiêu, và mất bao lâu để thu hồi vốn? Dự báo doanh thu 6 tháng đầu dựa trên căn cứ số liệu nào hay chỉ là ước tính chủ quan?`;
      }
    } else if (persona.id === JuryBossId.RISK_STRATEGIST) {
      if (preset === EvaluationPreset.SV_STARTUP) {
        fallbackText = `Nếu một doanh nghiệp lớn trên thị trường ra mắt tính năng tương tự, nhóm lấy vũ khí hay điểm khác biệt nào để cạnh tranh? Kế hoạch hành động cụ thể trong 6 tháng tới để đưa sản phẩm ra ngoài thực tế là gì?`;
      } else {
        fallbackText = `Thị trường hiện có những đối thủ với tiềm lực tài chính vượt trội. Rào cản phòng thủ độc quyền nào giúp bạn giữ chân khách hàng dài hạn, và các cột mốc kiểm chứng sống còn trong lộ trình 1 năm tới là gì?`;
      }
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
