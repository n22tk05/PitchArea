import { Injectable, Logger } from '@nestjs/common';
import { streamText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { JuryBossId, EvaluationPreset } from '@pitcharena/shared';
import { GroqKeyManager } from './groq-key-manager';
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
  previousQuestions?: string[];
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
      previousQuestions,
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
        preset,
        previousQuestions
      );
    }

    // 1. ƯU TIÊN GROQ (openai/gpt-oss-120b) với bộ xoay vòng và fallback tự động qua nhiều GROQ_API_KEY
    const groqKeys = GroqKeyManager.getRotatedKeys();
    if (groqKeys.length > 0) {
      for (let i = 0; i < groqKeys.length; i++) {
        const currentKey = groqKeys[i];
        const masked = GroqKeyManager.maskKey(currentKey);
        let accumulated = '';

        try {
          this.logger.log(
            `[GroqProvider] Kích hoạt Groq Key [${i + 1}/${groqKeys.length}] (${masked}) - Model: openai/gpt-oss-120b stream trực tiếp...`
          );

          const groq = createOpenAI({
            baseURL: 'https://api.groq.com/openai/v1',
            apiKey: currentKey,
          });

          const result = streamText({
            model: groq.chat('openai/gpt-oss-120b'),
            prompt,
            temperature: 0.85,
          });

          for await (const textPart of result.textStream) {
            accumulated += textPart;
            onChunk(textPart);
          }

          if (accumulated.trim().length > 0) {
            onComplete(accumulated);
            return accumulated;
          }
        } catch (groqErr: any) {
          this.logger.warn(
            `[GroqProvider] ⚠️ Groq Key (${masked}) gặp sự cố: "${groqErr.message}".`
          );
          // Nếu đã stream được một phần ra client thì giữ nguyên kết quả để tránh lặp từ
          if (accumulated.trim().length > 0) {
            this.logger.warn(`[GroqProvider] Đã stream được một phần nội dung, giữ nguyên kết quả.`);
            onComplete(accumulated);
            return accumulated;
          }
          // Nếu lỗi ngay từ đầu (Rate limit 429, timeout, quota...), tiếp tục vòng lặp sang key tiếp theo!
          if (i + 1 < groqKeys.length) {
            this.logger.log(`[GroqProvider] 🔄 Tự động chuyển sang Groq Key tiếp theo để tránh Rate Limit...`);
          } else {
            this.logger.warn(
              `[FALLBACK] ⚠️ Tất cả ${groqKeys.length} Groq API Keys đều gặp sự cố. Chuyển sang Gemini (${geminiKey ? 'API Key hợp lệ' : 'Chưa cấu hình'}).`
            );
          }
        }
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
          temperature: 0.85,
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

    const pickRandom = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

    if (isCoaching) {
      fallbackText =
        preset === EvaluationPreset.SV_STARTUP
          ? pickRandom([
              `Thầy cô hiểu đây là khó khăn lớn khi sinh viên làm sản phẩm thực tế. Một hướng tiếp cận khả thi là nhóm nên bắt đầu thử nghiệm trong quy mô hẹp tại trường để lấy phản hồi thực tế trước. Các em thấy giải pháp từng bước này có phù hợp với nguồn lực hiện tại của nhóm không?`,
              `Thầy cô đánh giá cao nỗ lực của nhóm. Thay vì dồn toàn bộ nguồn lực làm ngay hệ thống phức tạp, các em có thể làm trước một bản khảo sát đo lường chuyển đổi thực tế với 20 người dùng thân thiết. Nhóm nghĩ sao về hướng kiểm chứng này?`,
            ])
          : pickRandom([
              `Tôi hiểu đây là bài toán khó khi làm sản phẩm thực tế. Một hướng tiếp cận khả thi là bạn có thể áp dụng caching kết hợp batch inference để cắt giảm 70% chi phí API. Bạn thấy giải pháp phân kỳ này có thể áp dụng cho giai đoạn MVP của dự án không?`,
              `Tôi nhìn thấy tiềm năng của sản phẩm, nhưng bài toán mở rộng cần đi từng bước. Bạn có thể triển khai trước trên quy mô nhóm khách hàng hạt giống để đo tỷ lệ giữ chân thực tế trước khi rót vốn mở rộng không?`,
            ]);
    } else if (persona.id === JuryBossId.MARKET_SHARK) {
      if (preset === EvaluationPreset.SV_STARTUP) {
        fallbackText = pickRandom([
          `Nhóm đưa ra kết quả từ phiếu khảo sát nhưng chưa có người dùng chi tiền thực tế. Nhóm đã nói chuyện trực tiếp với bao nhiêu khách hàng tiềm năng và bằng chứng nào cho thấy họ sẵn sàng bỏ tiền mua sản phẩm này?`,
          `Trong số những người mà nhóm khảo sát, ai là người thực sự cảm thấy giải pháp này không thể thiếu và sẵn sàng trả tiền ngay hôm nay? Nếu nhóm không mở bán ngay, họ đang tự giải quyết vấn đề bằng cách nào?`,
          `Quy mô thị trường mà nhóm vẽ ra khá hấp dẫn, nhưng ai sẽ là khách hàng đầu tiên trả tiền cho nhóm trong 30 ngày tới? Nhóm tiếp cận họ qua kênh nào để không tốn kém chi phí marketing?`,
        ]);
      } else {
        fallbackText = pickRandom([
          `Khách hàng hiện tại đang quen với các cách làm truyền thống. Lý do thực tế và cấp bách nhất nào khiến họ chấp nhận thay đổi thói quen và trả tiền sử dụng giải pháp của nhóm ngay trong tháng đầu tiên?`,
          `Các chỉ số về mức độ sẵn sàng chi trả hiện tại dựa trên phỏng vấn hay đã có đơn đặt trước (pre-order)? Nếu đối thủ tung chiến dịch giảm giá 50%, khách hàng có tiếp tục dùng sản phẩm của bạn không?`,
        ]);
      }
    } else if (persona.id === JuryBossId.TECH_SENTINEL) {
      if (preset === EvaluationPreset.SV_STARTUP) {
        fallbackText = pickRandom([
          `Sản phẩm mẫu MVP của nhóm hiện tại đã chạy thực tế được những tính năng cốt lõi nào? Khi có hàng trăm sinh viên cùng truy cập một lúc, nhóm làm sao để giữ hệ thống không bị chậm hoặc sập máy chủ?`,
          `Phần công nghệ cốt lõi trong đề tài là do nhóm tự nghiên cứu thiết kế hay chủ yếu ghép nối API có sẵn? Khi thư viện hoặc dịch vụ bên ngoài ngừng hoạt động, sản phẩm của nhóm xử lý ra sao?`,
          `Thời gian phản hồi thực tế của sản phẩm khi bạn chạy thử trên máy người dùng là bao nhiêu giây? Bạn đã có kế hoạch thử nghiệm thực tế với thiết bị cấu hình yếu chưa?`,
        ]);
      } else {
        fallbackText = pickRandom([
          `Hệ thống của bạn có độ trễ đo đạc thực tế là bao nhiêu giây? Nếu mô hình AI gặp sự cố trả lời sai lệch thông tin nghiêm trọng, kiến trúc của bạn có phương án dự phòng tại chỗ nào để bảo vệ người dùng?`,
          `Kiến trúc mở rộng (scalability) của bạn đã được kiểm thử tải (stress test) đến ngưỡng bao nhiêu người dùng đồng thời? Điểm nghẽn tài nguyên lớn nhất đang nằm ở cơ sở dữ liệu hay ở thời gian xử lý thuật toán?`,
        ]);
      }
    } else if (persona.id === JuryBossId.FINANCE_DRAGON) {
      if (preset === EvaluationPreset.SV_STARTUP) {
        fallbackText = pickRandom([
          `Mức giá bán dự kiến cho mỗi sản phẩm là bao nhiêu tiền, và sau khi trừ chi phí sản xuất nhóm lãi được bao nhiêu? Với nguồn vốn sinh viên hạn hẹp, số tiền hiện có đủ duy trì hoạt động trong mấy tháng?`,
          `Nhóm dự tính thu tiền từ người dùng theo hình thức nào: thu phí theo gói, thuê bao hàng tháng hay lấy hoa hồng? Cơ sở nào để nhóm tin rằng mức giá này đủ bù đắp chi phí máy chủ và vận hành?`,
          `Để đạt được điểm hòa vốn đầu tiên, nhóm cần bán được bao nhiêu sản phẩm hoặc có bao nhiêu tài khoản trả phí? Nhóm lấy nguồn tiền nào để sản xuất đợt sản phẩm đầu tiên?`,
        ]);
      } else {
        fallbackText = pickRandom([
          `Chi phí thực tế để nhóm có được một khách hàng trả tiền là bao nhiêu, và mất bao lâu để thu hồi vốn? Dự báo doanh thu 6 tháng đầu dựa trên căn cứ số liệu nào hay chỉ là ước tính chủ quan?`,
          `Mỗi tháng nhóm đốt hết bao nhiêu tiền chi phí cố định (burn rate) và dòng tiền hiện tại cho phép nhóm sống sót trong bao lâu nếu chưa có doanh thu đột biến?`,
        ]);
      }
    } else if (persona.id === JuryBossId.RISK_STRATEGIST) {
      if (preset === EvaluationPreset.SV_STARTUP) {
        fallbackText = pickRandom([
          `Nếu một doanh nghiệp lớn trên thị trường ra mắt tính năng tương tự, nhóm lấy vũ khí hay điểm khác biệt nào để cạnh tranh? Kế hoạch hành động cụ thể trong 6 tháng tới để đưa sản phẩm ra ngoài thực tế là gì?`,
          `Điểm yếu lớn nhất khiến dự án này có thể phải dừng lại trong 6 tháng tới là gì? Nhóm đã chuẩn bị phương án dự phòng nào nếu một thành viên chủ chốt rời nhóm?`,
          `Lộ trình phát triển của nhóm từ phòng lab ra thị trường gồm những cột mốc nào? Điều kiện tối thiểu để nhóm chứng minh giải pháp này thực sự có tác động xã hội là gì?`,
        ]);
      } else {
        fallbackText = pickRandom([
          `Thị trường hiện có những đối thủ với tiềm lực tài chính vượt trội. Rào cản phòng thủ độc quyền nào giúp bạn giữ chân khách hàng dài hạn, và các cột mốc kiểm chứng sống còn trong lộ trình 1 năm tới là gì?`,
          `Kế hoạch bảo hộ sở hữu trí tuệ hoặc thỏa thuận bảo mật dữ liệu của bạn đã được thực hiện đến đâu để ngăn chặn nguy cơ bị rò rỉ mã nguồn hoặc bị đối thủ sao chép công nghệ?`,
        ]);
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
