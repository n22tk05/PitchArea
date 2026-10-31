import { Injectable, Logger } from '@nestjs/common';
import { streamText, generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { JuryBossId, EvaluationPreset, CrossGroundingContext } from '@pitcharena/shared';
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
  topicId?: string;
  isCoachingPivot?: boolean;
  candidateHistory?: string;
  preset?: EvaluationPreset;
  previousQuestions?: string[];
  crossGroundingContext?: CrossGroundingContext;
  resolvedQAPairs?: Array<{ bossName?: string; question: string; candidateAnswer: string }>;
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
        previousQuestions,
        options.crossGroundingContext,
        options.resolvedQAPairs
      );
    }

    // 1. ƯU TIÊN GROQ (openai/gpt-oss-120b & 20b) với bộ xoay vòng và fallback tự động qua nhiều GROQ_API_KEY
    const groqKeys = GroqKeyManager.getRotatedKeys();
    const groqModels = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'];

    if (groqKeys.length > 0) {
      for (let i = 0; i < groqKeys.length; i++) {
        const currentKey = groqKeys[i];
        const masked = GroqKeyManager.maskKey(currentKey);

        for (const modelName of groqModels) {
          let accumulated = '';
          try {
            this.logger.log(
              `[GroqProvider] Kích hoạt Groq Key [${i + 1}/${groqKeys.length}] (${masked}) - Model: ${modelName} stream trực tiếp...`
            );

            const groq = createOpenAI({
              baseURL: 'https://api.groq.com/openai/v1',
              apiKey: currentKey,
            });

            const result = streamText({
              model: groq.chat(modelName),
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
              `[GroqProvider] ⚠️ Groq Key (${masked}) Model (${modelName}) gặp sự cố: "${groqErr.message}".`
            );
            // Nếu đã stream được một phần ra client thì giữ nguyên kết quả để tránh lặp từ
            if (accumulated.trim().length > 0) {
              this.logger.warn(`[GroqProvider] Đã stream được một phần nội dung, giữ nguyên kết quả.`);
              onComplete(accumulated);
              return accumulated;
            }
          }
        }

        if (i + 1 < groqKeys.length) {
          this.logger.log(`[GroqProvider] 🔄 Tự động chuyển sang Groq Key tiếp theo để tránh Rate Limit...`);
        } else {
          this.logger.warn(
            `[FALLBACK] ⚠️ Tất cả ${groqKeys.length} Groq API Keys đều gặp sự cố. Chuyển sang Gemini (${geminiKey ? 'API Key hợp lệ' : 'Chưa cấu hình'}).`
          );
        }
      }
    }

    // 2. Dự phòng Google Gemini (gemini-flash-latest / gemini-3.5-flash) nếu không có Groq hoặc Groq lỗi
    if (geminiKey) {
      const geminiModels = ['gemini-flash-latest', 'gemini-3.5-flash'];
      const googleProvider = createGoogleGenerativeAI({ apiKey: geminiKey });

      for (const geminiModel of geminiModels) {
        this.logger.log(`[GeminiService] Đang stream qua Google Gemini (${geminiModel})...`);
        try {
          const result = streamText({
            model: googleProvider(geminiModel),
            prompt,
            temperature: 0.85,
            maxRetries: 0,
          });

          let accumulated = '';
          for await (const textPart of result.textStream) {
            accumulated += textPart;
            onChunk(textPart);
          }

          if (accumulated.trim().length > 0) {
            onComplete(accumulated);
            return accumulated;
          }
        } catch (err: any) {
          this.logger.warn(
            `[FALLBACK] ⚠️ Google Gemini (${geminiModel}) gặp sự cố: "${err.message}".`
          );
        }
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
      previousQuestions,
      options.topicId,
      onChunk,
      onComplete
    );
  }

  /**
   * Ngân hàng câu hỏi Offline Fallback theo 32 Chủ đề chuyên biệt của 4 Giám khảo (8 chủ đề/Boss)
   */
  private static readonly TOPIC_FALLBACK_QUESTIONS: Record<string, string[]> = {
    // 1. Shark Trần Nam (Market Shark)
    mkt_old_habit: [
      'Khách hàng hiện tại đang quen với các cách làm truyền thống. Lý do cấp bách nhất nào khiến họ chấp nhận thay đổi thói quen và chuyển sang dùng giải pháp của nhóm ngay hôm nay?',
      'Nếu nhóm không ra mắt giải pháp này, khách hàng mục tiêu đang tự giải quyết vấn đề bằng cách nào và họ đã chịu đựng sự bất tiện đó bao lâu rồi?',
    ],
    mkt_real_interviews: [
      'Nhóm đã phỏng vấn sâu trực tiếp bao nhiêu người dùng thật ngoài đời, và đâu là phản hồi gay gắt nhất mà nhóm nhận được khi cho họ xem thử giải pháp?',
      'Các con số khảo sát của nhóm dựa trên biểu mẫu trực tuyến hay nhóm đã ngồi đối thoại 1-1 với khách hàng để chứng kiến nỗi đau thực tế?',
    ],
    mkt_first_paying_users: [
      'Bằng chứng nào chứng minh người dùng thực sự sẵn sàng trả tiền thay vì chỉ nói ủng hộ trên phiếu khảo sát? Nhóm đã có cam kết đặt trước nào chưa?',
      'Ai sẽ là 10 khách hàng đầu tiên chịu chi tiền cho sản phẩm trong 30 ngày tới, và nhóm thuyết phục họ bằng giá trị định lượng cụ thể nào?',
    ],
    mkt_customer_acquisition: [
      'Nhóm dự định tiếp cận 100 khách hàng đầu tiên qua kênh cụ thể nào mà không tốn ngân sách chạy quảng cáo? Chi phí tìm một khách hàng là bao nhiêu?',
      'Chiến dịch tiếp cận khách hàng đầu tiên tại trường học hoặc địa phương sẽ được nhóm triển khai cụ thể ra sao trong 4 tuần tới?',
    ],
    mkt_retention_urgency: [
      'Sau lần sử dụng đầu tiên, điều gì thôi thúc người dùng quay lại sử dụng sản phẩm hàng ngày thay vì tải về rồi bỏ xó?',
      'Tần suất người dùng gặp phải vấn đề này là bao nhiêu lần một tuần, và mức độ thiệt hại nếu họ không dùng giải pháp của bạn là gì?',
    ],
    mkt_target_segment: [
      'Tại sao nhóm lại chọn phân khúc khách hàng ngách này để bắt đầu thay vì một tệp thị trường đại chúng dễ tiếp cận hơn?',
      'Dung lượng thực tế của nhóm khách hàng mục tiêu ban đầu này tại địa bàn của nhóm là bao nhiêu người, và họ có đủ khả năng chi trả không?',
    ],
    mkt_competitive_alternatives: [
      'Nếu khách hàng so sánh giải pháp của nhóm với các công cụ miễn phí hoặc có sẵn trên thị trường, điểm khác biệt sống còn nào khiến họ chọn nhóm?',
      'Tại sao đối thủ hiện tại chưa giải quyết triệt để vấn đề này, và nhóm có lợi thế gì mà họ không thể sao chép?',
    ],
    mkt_expansion_friction: [
      'Khi mở rộng ra khỏi môi trường học đường thân thuộc, rào cản lớn nhất khiến người dùng bên ngoài ngại tiếp cận giải pháp của nhóm là gì?',
      'Quy trình hướng dẫn người dùng mới từ lúc biết đến sản phẩm đến khi dùng thành thạo mất bao nhiêu phút và có bị vướng mắc ở khâu nào không?',
    ],

    // 2. TS. Lê Minh Trang (Tech Sentinel)
    tech_data_flow: [
      'Hãy mô tả ngắn gọn luồng dữ liệu từ khi người dùng nhập dữ liệu đầu vào đến khi hệ thống trả về kết quả cuối cùng qua những bước kỹ thuật nào?',
      'Các bước xử lý logic cốt lõi bên dưới diễn ra như thế nào, và dữ liệu được lưu trữ hay xử lý tại máy khách hay máy chủ?',
    ],
    tech_core_vs_api: [
      'Đâu là phần giải thuật hay công nghệ do chính sinh viên trong nhóm tự nghiên cứu thiết kế, và đâu là phần phụ thuộc vào API của bên thứ ba?',
      'Nếu nhà cung cấp dịch vụ hoặc thư viện bên ngoài tăng giá gấp 3 lần hoặc ngừng cung cấp, nhóm có tự chủ công nghệ để thay thế được không?',
    ],
    tech_offline_fallback: [
      'Khi thiết bị người dùng bị mất kết nối mạng hoặc API bên thứ ba gặp sự cố, hệ thống có cơ chế bộ đệm Offline nào để không làm gián đoạn trải nghiệm?',
      'Kiến trúc của nhóm xử lý ngoại lệ mất kết nối như thế nào, và dữ liệu phát sinh ngoại tuyến được đồng bộ ngược lại máy chủ ra sao khi có mạng?',
    ],
    tech_edge_case_handling: [
      'Hệ thống xử lý ra sao khi gặp dữ liệu đầu vào bị rác, mờ, thiếu trường hoặc người dùng cố tình thao tác sai kịch bản chuẩn?',
      'Nhóm đã thử nghiệm hệ thống trong điều kiện môi trường thực tế bị nhiễu sóng hoặc ánh sáng kém chưa, và độ suy giảm hiệu năng là bao nhiêu %?',
    ],
    tech_empirical_metrics: [
      'Nhóm đã kiểm thử thực nghiệm trên bao nhiêu mẫu dữ liệu thật, và thông số độ trễ đo đạc thực tế (P95) cùng mức tải RAM là bao nhiêu?',
      'Độ chính xác và thời gian phản hồi của hệ thống khi chạy trên các thiết bị phần cứng thực tế đạt được con số cụ thể là bao nhiêu?',
    ],
    tech_scalability_load: [
      'Nếu cùng lúc có 500 đến 1000 người dùng đồng thời truy cập, hệ thống của nhóm sẽ nghẽn ở đâu: cơ sở dữ liệu, băng thông hay thuật toán xử lý?',
      'Kiến trúc máy chủ của nhóm đã được kiểm thử tải (stress test) đến ngưỡng nào, và phương án mở rộng tài nguyên tự động ra sao?',
    ],
    tech_security_privacy: [
      'Dữ liệu nhạy cảm của người dùng được mã hóa và bảo vệ như thế nào để ngăn chặn nguy cơ rò rỉ hoặc bị đánh cắp thông tin?',
      'Cơ chế phân quyền và kiểm soát truy cập trong hệ thống được thiết kế ra sao để đảm bảo an toàn thông tin theo quy định pháp luật?',
    ],
    tech_hardware_integration: [
      'Ứng dụng của nhóm đòi hỏi cấu hình phần cứng tối thiểu như thế nào, và có thể chạy mượt mà trên các thiết bị đời cũ của người dùng không?',
      'Khả năng tương thích và tích hợp của giải pháp vào hạ tầng thiết bị sẵn có của khách hàng đòi hỏi chi phí lắp đặt thêm là bao nhiêu?',
    ],

    // 3. GS. Vũ Hoàng (Finance Dragon)
    fin_mvp_budget: [
      'Số tiền tối thiểu để nhóm hoàn thiện bản thử nghiệm MVP chạy thật là bao nhiêu tiền, và nguồn kinh phí đó được nhóm lấy từ đâu?',
      'Trong các hạng mục chi phí làm sản phẩm ban đầu, khoản chi nào chiếm tỷ trọng lớn nhất và nhóm đã tối ưu nó như thế nào?',
    ],
    fin_monthly_opex: [
      'Chi phí cố định hàng tháng (máy chủ, tên miền, API, vận hành) để duy trì hệ thống là bao nhiêu tiền, và nhóm lấy nguồn nào bù đắp khi chưa có doanh thu?',
      'Nếu trong 6 tháng đầu chưa có khách hàng trả phí, chi phí tối thiểu để giữ hệ thống sống sót là bao nhiêu và nhóm tự duy trì được bao lâu?',
    ],
    fin_break_even_volume: [
      'Nhóm cần bán được bao nhiêu sản phẩm hoặc có bao nhiêu tài khoản trả phí mỗi tháng để đạt điểm hòa vốn tự trang trải chi phí?',
      'Căn cứ vào đâu để nhóm tính ra sản lượng hòa vốn đó, và mất bao nhiêu tháng nhóm dự kiến sẽ chạm tới cột mốc này?',
    ],
    fin_unit_pricing: [
      'Cơ sở định lượng nào để nhóm đưa ra mức giá bán này, và người dùng tiết kiệm hoặc kiếm thêm được bao nhiêu tiền khi chi trả cho nhóm?',
      'Sau khi trừ đi giá vốn và chi phí trực tiếp trên mỗi đơn vị dịch vụ, nhóm còn lại biên lợi nhuận gộp là bao nhiêu phần trăm?',
    ],
    fin_bootstrap_runway: [
      'Kế hoạch tài chính tự lực (Bootstrapping) của nhóm trong 6 tháng đầu gồm những kịch bản cắt giảm chi phí sinh tồn nào khi chưa có nhà đầu tư?',
      'Nhóm có quỹ dự phòng khẩn cấp bao nhiêu tiền, và nếu ngân sách cạn kiệt thì dự án sẽ tiếp tục bằng cách nào?',
    ],
    fin_revenue_streams: [
      'Cấu trúc dòng tiền thu về của nhóm đến từ những nguồn nào cụ thể: thu phí một lần, gói thuê bao định kỳ hay hoa hồng dịch vụ?',
      'Nguồn thu nào sẽ đóng góp hơn 70% doanh thu của dự án trong năm đầu tiên, và cơ chế thu tiền thực tế diễn ra như thế nào?',
    ],
    fin_capital_efficiency: [
      'Nếu nhận được giải thưởng hoặc tiền tài trợ 30-50 triệu từ cuộc thi, nhóm sẽ phân bổ từng khoản tiền vào những việc gì để đạt hiệu quả cao nhất?',
      'Khoản tiền tài trợ ban đầu sẽ giúp nhóm đạt được cột mốc kiểm chứng kỹ thuật hay kinh doanh cụ thể nào trước khi cần thêm vốn?',
    ],
    fin_financial_risk_hedge: [
      'Khi chi phí API hoặc dịch vụ hạ tầng tăng vọt ngoài dự tính do lượng người dùng tăng, nhóm có phương án tài chính dự phòng nào để không bị lỗ nặng?',
      'Nhóm đã tính toán rủi ro biến động giá nguyên vật liệu hoặc chi phí đối tác bên ngoài vào bài toán tài chính chưa?',
    ],

    // 4. ThS. Đặng Mai Lan (Risk Strategist)
    risk_defense_moat: [
      'Rào cản phòng thủ nào giúp nhóm bảo vệ thành quả nếu một đối thủ lớn có sẵn tiềm lực tài chính tung ra tính năng tương tự trong 2 tuần?',
      'Điểm khác biệt độc quyền không thể sao chép của nhóm nằm ở đâu: dữ liệu bản địa, thuật toán độc quyền hay mạng lưới quan hệ khách hàng?',
    ],
    risk_graduation_cliff: [
      'Sau cuộc thi hoặc vài tháng nữa khi các thành viên tốt nghiệp ra trường đi làm công ty, ai sẽ tiếp tục duy trì dự án hay đề tài sẽ bị bỏ xó?',
      'Cơ chế cam kết thời gian và phân chia quyền lợi giữa các sáng lập viên được nhóm thống nhất như thế nào để tránh tan rã đội ngũ?',
    ],
    risk_ip_copyright: [
      'Nhóm đã có kế hoạch đăng ký bản quyền tác giả phần mềm, nhãn hiệu hoặc giải pháp hữu ích chưa để tránh bị tranh chấp sở hữu trí tuệ?',
      'Dữ liệu và thuật toán nhóm sử dụng có nguy cơ vi phạm điều khoản bản quyền của bên thứ ba nào không, và nhóm kiểm soát điều này ra sao?',
    ],
    risk_pilot_roadmap: [
      'Kế hoạch kiểm chứng thực địa trong 3-6 tháng tới gồm những cột mốc định lượng nào, và đơn vị nào đã đồng ý cho nhóm thử nghiệm pilot?',
      'Tiêu chí cụ thể nào để nhóm xác nhận một đợt thử nghiệm pilot là thành công trước khi triển khai trên diện rộng?',
    ],
    risk_competitive_comparison: [
      'Điểm yếu chí mạng nhất của giải pháp nhóm khi đặt cạnh đối thủ dẫn đầu thị trường là gì, và nhóm làm thế nào để người dùng không bỏ đi?',
      'Bảng so sánh tính năng trực diện của nhóm với các giải pháp hiện nay cho thấy nhóm vượt trội ở những khía cạnh thực tế nào?',
    ],
    risk_market_shifts: [
      'Nếu tệp khách hàng ban đầu từ chối sử dụng sản phẩm sau 3 tháng thử nghiệm, nhóm có kịch bản chuyển hướng (Pivot) dự phòng nào?',
      'Các biến động về chính sách hoặc thị trường tiêu cực nào có thể ảnh hưởng trực tiếp đến sự tồn tại của mô hình kinh doanh này?',
    ],
    risk_legal_compliance: [
      'Dự án có thuộc ngành nghề kinh doanh có điều kiện hoặc yêu cầu giấy phép chuyên ngành nào không, và nhóm xử lý hành lang pháp lý này ra sao?',
      'Quy định về bảo vệ dữ liệu cá nhân theo Nghị định 13 được nhóm tuân thủ như thế nào trong quá trình thu thập thông tin người dùng?',
    ],
    risk_team_skill_gaps: [
      'Đội ngũ của nhóm hiện đang thiếu hụt kỹ năng quan trọng nào nhất, và nhóm có kế hoạch tìm kiếm cố vấn hay bổ sung nhân sự ra sao?',
      'Sự phân công trách nhiệm giữa các thành viên kỹ thuật và kinh doanh trong 6 tháng tới được định lượng bằng những KPI cụ thể nào?',
    ],
  };

  /**
   * Giả lập stream fallback câu hỏi từng từ tốc độ cao (~30ms/word) khi offline
   */
  private async fallbackStreamQuestion(
    persona: any,
    topic?: string,
    isCoaching?: boolean,
    preset?: EvaluationPreset,
    previousQuestions?: string[],
    topicId?: string,
    onChunk?: (c: string) => void,
    onComplete?: (t: string) => void
  ): Promise<string> {
    this.logger.log(
      `[FALLBACK] 🔄 Đang tạo câu hỏi Fallback mô phỏng cho Giám khảo ${persona.name} | Chủ đề: ${topic || 'Tổng quát'} [ID: ${topicId || 'N/A'}] | Preset: ${preset || 'SV_STARTUP'}`
    );
    let fallbackText = '';

    const pickRandom = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

    const isAlreadyAsked = (q: string): boolean => {
      if (!previousQuestions || previousQuestions.length === 0) return false;
      const snippet = q.slice(0, 35).toLowerCase();
      return previousQuestions.some((prev) => {
        const p = prev.toLowerCase();
        return p.includes(snippet) || snippet.includes(p.slice(0, 35));
      });
    };

    if (isCoaching) {
      const coachingCandidates =
        preset === EvaluationPreset.SV_STARTUP
          ? [
              `Thầy cô hiểu đây là khó khăn lớn khi sinh viên làm sản phẩm thực tế. Một hướng tiếp cận khả thi là nhóm nên bắt đầu thử nghiệm trong quy mô hẹp tại trường để lấy phản hồi thực tế trước. Các em thấy giải pháp từng bước này có phù hợp với nguồn lực hiện tại của nhóm không?`,
              `Thầy cô đánh giá cao nỗ lực của nhóm. Thay vì dồn toàn bộ nguồn lực làm ngay hệ thống phức tạp, các em có thể làm trước một bản khảo sát đo lường chuyển đổi thực tế với 20 người dùng thân thiết. Nhóm nghĩ sao về hướng kiểm chứng này?`,
            ]
          : [
              `Tôi hiểu đây là bài toán khó khi làm sản phẩm thực tế. Một hướng tiếp cận khả thi là bạn có thể áp dụng caching kết hợp batch inference để cắt giảm 70% chi phí API. Bạn thấy giải pháp phân kỳ này có thể áp dụng cho giai đoạn MVP của dự án không?`,
              `Tôi nhìn thấy tiềm năng của sản phẩm, nhưng bài toán mở rộng cần đi từng bước. Bạn có thể triển khai trước trên quy mô nhóm khách hàng hạt giống để đo tỷ lệ giữ chân thực tế trước khi rót vốn mở rộng không?`,
            ];

      const availableCoaching = coachingCandidates.filter((q) => !isAlreadyAsked(q));
      fallbackText = availableCoaching.length > 0 ? pickRandom(availableCoaching) : pickRandom(coachingCandidates);
    } else {
      // 1. Thử tìm câu hỏi chính xác theo topicId trong ngân hàng 32 chủ đề
      let topicCandidates: string[] = [];
      if (topicId && GeminiService.TOPIC_FALLBACK_QUESTIONS[topicId]) {
        topicCandidates = GeminiService.TOPIC_FALLBACK_QUESTIONS[topicId];
      }

      // 2. Nếu chưa có candidates, thử tìm key theo topic name
      if (topicCandidates.length === 0 && topic) {
        for (const [key, questions] of Object.entries(GeminiService.TOPIC_FALLBACK_QUESTIONS)) {
          if (topic.toLowerCase().includes(key.replace(/^[a-z]+_/, '').replace(/_/g, ' '))) {
            topicCandidates = questions;
            break;
          }
        }
      }

      // Lọc các câu hỏi chưa từng được hỏi
      const availableTopicCandidates = topicCandidates.filter((q) => !isAlreadyAsked(q));
      if (availableTopicCandidates.length > 0) {
        fallbackText = pickRandom(availableTopicCandidates);
      } else if (topicCandidates.length > 0) {
        fallbackText = pickRandom(topicCandidates);
      } else {
        // 3. Fallback theo Boss chung nếu không match chủ đề
        let bossGeneralCandidates: string[] = [];
        if (persona.id === JuryBossId.MARKET_SHARK) {
          bossGeneralCandidates = [
            `Nhóm đưa ra kết quả từ phiếu khảo sát nhưng chưa có người dùng chi tiền thực tế. Nhóm đã nói chuyện trực tiếp với bao nhiêu khách hàng tiềm năng và bằng chứng nào cho thấy họ sẵn sàng bỏ tiền mua sản phẩm này?`,
            `Trong số những người mà nhóm khảo sát, ai là người thực sự cảm thấy giải pháp này không thể thiếu và sẵn sàng trả tiền ngay hôm nay? Nếu nhóm không mở bán ngay, họ đang tự giải quyết vấn đề bằng cách nào?`,
            `Quy mô thị trường mà nhóm vẽ ra khá hấp dẫn, nhưng ai sẽ là khách hàng đầu tiên trả tiền cho nhóm trong 30 ngày tới? Nhóm tiếp cận họ qua kênh nào để không tốn kém chi phí marketing?`,
            `Khách hàng hiện tại đang quen với các cách làm truyền thống. Lý do thực tế và cấp bách nhất nào khiến họ chấp nhận thay đổi thói quen và trả tiền sử dụng giải pháp của nhóm ngay trong tháng đầu tiên?`,
          ];
        } else if (persona.id === JuryBossId.TECH_SENTINEL) {
          bossGeneralCandidates = [
            `Sản phẩm mẫu MVP của nhóm hiện tại đã chạy thực tế được những tính năng cốt lõi nào? Khi có hàng trăm sinh viên cùng truy cập một lúc, nhóm làm sao để giữ hệ thống không bị chậm hoặc sập máy chủ?`,
            `Phần công nghệ cốt lõi trong đề tài là do nhóm tự nghiên cứu thiết kế hay chủ yếu ghép nối API có sẵn? Khi thư viện hoặc dịch vụ bên ngoài ngừng hoạt động, sản phẩm của nhóm xử lý ra sao?`,
            `Thời gian phản hồi thực tế của sản phẩm khi bạn chạy thử trên máy người dùng là bao nhiêu giây? Bạn đã có kế hoạch thử nghiệm thực tế với thiết bị cấu hình yếu chưa?`,
            `Hệ thống của bạn có độ trễ đo đạc thực tế là bao nhiêu giây? Nếu mô hình AI gặp sự cố trả lời sai lệch thông tin nghiêm trọng, kiến trúc của bạn có phương án dự phòng tại chỗ nào để bảo vệ người dùng?`,
          ];
        } else if (persona.id === JuryBossId.FINANCE_DRAGON) {
          bossGeneralCandidates = [
            `Mức giá bán dự kiến cho mỗi sản phẩm là bao nhiêu tiền, và sau khi trừ chi phí sản xuất nhóm lãi được bao nhiêu? Với nguồn vốn sinh viên hạn hẹp, số tiền hiện có đủ duy trì hoạt động trong mấy tháng?`,
            `Nhóm dự tính thu tiền từ người dùng theo hình thức nào: thu phí theo gói, thuê bao hàng tháng hay lấy hoa hồng? Cơ sở nào để nhóm tin rằng mức giá này đủ bù đắp chi phí máy chủ và vận hành?`,
            `Để đạt được điểm hòa vốn đầu tiên, nhóm cần bán được bao nhiêu sản phẩm hoặc có bao nhiêu tài khoản trả phí? Nhóm lấy nguồn tiền nào để sản xuất đợt sản phẩm đầu tiên?`,
            `Chi phí thực tế để nhóm có được một khách hàng trả tiền là bao nhiêu, và mất bao lâu để thu hồi vốn? Dự báo doanh thu 6 tháng đầu dựa trên căn cứ số liệu nào hay chỉ là ước tính chủ quan?`,
          ];
        } else if (persona.id === JuryBossId.RISK_STRATEGIST) {
          bossGeneralCandidates = [
            `Nếu một doanh nghiệp lớn trên thị trường ra mắt tính năng tương tự, nhóm lấy vũ khí hay điểm khác biệt nào để cạnh tranh? Kế hoạch hành động cụ thể trong 6 tháng tới để đưa sản phẩm ra ngoài thực tế là gì?`,
            `Điểm yếu lớn nhất khiến dự án này có thể phải dừng lại trong 6 tháng tới là gì? Nhóm đã chuẩn bị phương án dự phòng nào nếu một thành viên chủ chốt rời nhóm?`,
            `Lộ trình phát triển của nhóm từ phòng lab ra thị trường gồm những cột mốc nào? Điều kiện tối thiểu để nhóm chứng minh giải pháp này thực sự có tác động xã hội là gì?`,
            `Thị trường hiện có những đối thủ với tiềm lực tài chính vượt trội. Rào cản phòng thủ độc quyền nào giúp bạn giữ chân khách hàng dài hạn, và các cột mốc kiểm chứng sống còn trong lộ trình 1 năm tới là gì?`,
          ];
        }

        const availableGeneral = bossGeneralCandidates.filter((q) => !isAlreadyAsked(q));
        fallbackText = availableGeneral.length > 0 ? pickRandom(availableGeneral) : pickRandom(bossGeneralCandidates);
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

  /**
   * Sinh hoàn tất siêu tốc (Fast Completion) không qua stream phục vụ thẩm định MAD Chamber kín
   */
  public async generateFastCompletion(
    prompt: string,
    maxTokens = 600
  ): Promise<string> {
    const groqKeys = GroqKeyManager.getRotatedKeys();
    const groqModels = [
      'openai/gpt-oss-120b',
      'openai/gpt-oss-20b',
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
    ];

    // 1. Thử qua Groq
    if (groqKeys.length > 0) {
      for (const currentKey of groqKeys) {
        for (const modelName of groqModels) {
          try {
            const groq = createOpenAI({
              baseURL: 'https://api.groq.com/openai/v1',
              apiKey: currentKey,
            });

            const result = await generateText({
              model: groq.chat(modelName),
              prompt,
              temperature: 0.3, // Nhiệt độ thấp cho phán quyết ổn định & chính xác
            });

            if (result.text && result.text.trim().length > 0) {
              return result.text.trim();
            }
          } catch (groqErr: any) {
            this.logger.debug(
              `[generateFastCompletion] Groq model ${modelName} lỗi: ${groqErr.message}`
            );
          }
        }
      }
    }

    // 2. Thử qua Google Gemini
    const geminiKey =
      process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (geminiKey) {
      const geminiModels = ['gemini-flash-latest', 'gemini-2.0-flash', 'gemini-1.5-flash'];
      const googleProvider = createGoogleGenerativeAI({ apiKey: geminiKey });

      for (const geminiModel of geminiModels) {
        try {
          const result = await generateText({
            model: googleProvider(geminiModel),
            prompt,
            temperature: 0.3,
          });

          if (result.text && result.text.trim().length > 0) {
            return result.text.trim();
          }
        } catch (geminiErr: any) {
          this.logger.debug(
            `[generateFastCompletion] Gemini model ${geminiModel} lỗi: ${geminiErr.message}`
          );
        }
      }
    }

    throw new Error('Tất cả AI LLM providers đều không khả dụng cho Fast Completion.');
  }
}
