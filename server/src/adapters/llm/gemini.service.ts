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
      options.resolvedQAPairs,
      onChunk,
      onComplete
    );
  }

  /**
   * Ngân hàng câu hỏi Offline Fallback theo 32 Chủ đề chuyên biệt của 4 Giám khảo (8 chủ đề/Boss x 4 câu hỏi thực chiến)
   */
  private static readonly TOPIC_FALLBACK_QUESTIONS: Record<string, string[]> = {
    // 1. Shark Trần Nam (Market Shark)
    mkt_old_habit: [
      'Khách hàng hiện tại đang quen với các cách làm truyền thống. Lý do cấp bách nhất nào khiến họ chấp nhận thay đổi thói quen và chuyển sang dùng giải pháp của nhóm ngay hôm nay?',
      'Nếu nhóm không ra mắt giải pháp này, khách hàng mục tiêu đang tự giải quyết vấn đề bằng cách nào và họ đã chịu đựng sự bất tiện đó bao lâu rồi?',
      'Chi phí chuyển đổi (Switching Cost) về thời gian và công sức để người dùng từ bỏ công cụ cũ sang dùng phần mềm của nhóm là bao nhiêu?',
      'Tại sao các giải pháp thủ công hoặc thói quen cũ vẫn tồn tại được nhiều năm qua mà chưa bị đào thải, nhóm có nghiên cứu lý do tâm lý người dùng chưa?',
    ],
    mkt_real_interviews: [
      'Nhóm đã phỏng vấn sâu trực tiếp bao nhiêu người dùng thật ngoài đời, và đâu là phản hồi gay gắt nhất mà nhóm nhận được khi cho họ xem thử giải pháp?',
      'Các con số khảo sát của nhóm dựa trên biểu mẫu trực tuyến hay nhóm đã ngồi đối thoại 1-1 với khách hàng để chứng kiến nỗi đau thực tế?',
      'Khi phỏng vấn người dùng mục tiêu, nhóm có đưa họ tự thao tác sản phẩm không hay chỉ giải thích và hỏi họ có thích không?',
      'Hãy trích dẫn nguyên văn 1 nhận xét tiêu cực nhất của khách hàng khi trải nghiệm giải pháp và nhóm đã chỉnh sửa tính năng gì dựa trên phản hồi đó?',
    ],
    mkt_first_paying_users: [
      'Bằng chứng nào chứng minh người dùng thực sự sẵn sàng trả tiền thay vì chỉ nói ủng hộ trên phiếu khảo sát? Nhóm đã có cam kết đặt trước nào chưa?',
      'Ai sẽ là 10 khách hàng đầu tiên chịu chi tiền cho sản phẩm trong 30 ngày tới, và nhóm thuyết phục họ bằng giá trị định lượng cụ thể nào?',
      'Nhóm đã có biên bản ghi nhớ (MOU) hay thư bày tỏ quan tâm (LOI) có điều khoản trả phí thử nghiệm danh nghĩa từ bất kỳ đơn vị nào chưa?',
      'Nếu yêu cầu người dùng đặt cọc trước một khoản tiền nhỏ 20-50 nghìn đồng để giữ chỗ trải nghiệm, nhóm tự tin có bao nhiêu người đồng ý chuyển khoản ngay?',
    ],
    mkt_customer_acquisition: [
      'Nhóm dự định tiếp cận 100 khách hàng đầu tiên qua kênh cụ thể nào mà không tốn ngân sách chạy quảng cáo? Chi phí tìm một khách hàng là bao nhiêu?',
      'Chiến dịch tiếp cận khách hàng đầu tiên tại trường học hoặc địa phương sẽ được nhóm triển khai cụ thể ra sao trong 4 tuần tới?',
      'Kênh truyền miệng (Word of mouth) của nhóm được thiết kế như thế nào để một người dùng hài lòng tự động rủ thêm ít nhất 2 người khác cùng dùng?',
      'Chi phí chuyển đổi trên mỗi lượt tiếp cận (CAC) dự tính là bao nhiêu, và nhóm kiểm soát chi phí này ra sao khi mở rộng ra ngoài phạm vi quen biết?',
    ],
    mkt_retention_urgency: [
      'Sau lần sử dụng đầu tiên, điều gì thôi thúc người dùng quay lại sử dụng sản phẩm hàng ngày thay vì tải về rồi bỏ xó?',
      'Tần suất người dùng gặp phải vấn đề này là bao nhiêu lần một tuần, và mức độ thiệt hại nếu họ không dùng giải pháp của bạn là gì?',
      'Tỷ lệ giữ chân người dùng (Retention Rate) sau 30 ngày nhóm kỳ vọng đạt bao nhiêu phần trăm, và tính năng nào đóng vai trò giữ chân then chốt?',
      'Sản phẩm này là "thuốc giảm đau" giải quyết việc cấp bách hàng ngày hay chỉ là "vitamin" có thì tốt mà không có cũng chẳng sao?',
    ],
    mkt_target_segment: [
      'Tại sao nhóm lại chọn phân khúc khách hàng ngách này để bắt đầu thay vì một tệp thị trường đại chúng dễ tiếp cận hơn?',
      'Dung lượng thực tế của nhóm khách hàng mục tiêu ban đầu này tại địa bàn của nhóm là bao nhiêu người, và họ có đủ khả năng chi trả không?',
      'Nhóm có thể mô tả chân dung một khách hàng điển hình nhất: độ tuổi, mức thu nhập, thói quen sinh hoạt và rào cản chi tiêu của họ?',
      'Nếu phân khúc ngách này quá nhỏ không đủ tạo ra dòng tiền bền vững, nhóm có kế hoạch mở rộng tệp khách hàng liền kề nào tiếp theo?',
    ],
    mkt_competitive_alternatives: [
      'Nếu khách hàng so sánh giải pháp của nhóm với các công cụ miễn phí hoặc có sẵn trên thị trường, điểm khác biệt sống còn nào khiến họ chọn nhóm?',
      'Tại sao đối thủ hiện tại chưa giải quyết triệt để vấn đề này, và nhóm có lợi thế gì mà họ không thể sao chép?',
      'Khách hàng có thể kết hợp các ứng dụng miễn phí sẵn có để đạt kết quả tương tự không, tại sao họ phải trả thêm tiền mua sản phẩm của nhóm?',
      'So sánh trực diện 3 tính năng mạnh nhất của nhóm với đối thủ lớn nhất, nhóm vượt trội ở điểm nào và thua kém ở điểm nào?',
    ],
    mkt_expansion_friction: [
      'Khi mở rộng ra khỏi môi trường học đường thân thuộc, rào cản lớn nhất khiến người dùng bên ngoài ngại tiếp cận giải pháp của nhóm là gì?',
      'Quy trình hướng dẫn người dùng mới từ lúc biết đến sản phẩm đến khi dùng thành thạo mất bao nhiêu phút và có bị vướng mắc ở khâu nào không?',
      'Nhóm đã chuẩn bị kịch bản xử lý khiếu nại và hỗ trợ người dùng khi họ gặp lỗi trong quá trình sử dụng lần đầu như thế nào?',
      'Đặc thù văn hóa vùng miền hoặc thói quen công nghệ của người dùng lớn tuổi có cản trở tốc độ phổ cập ứng dụng của nhóm không?',
    ],

    // 2. TS. Lê Minh Trang (Tech Sentinel)
    tech_data_flow: [
      'Hãy mô tả ngắn gọn luồng dữ liệu từ khi người dùng nhập dữ liệu đầu vào đến khi hệ thống trả về kết quả cuối cùng qua những bước kỹ thuật nào?',
      'Các bước xử lý logic cốt lõi bên dưới diễn ra như thế nào, và dữ liệu được lưu trữ hay xử lý tại máy khách hay máy chủ?',
      'Dữ liệu thô được chuẩn hóa, tiền xử lý và lưu trữ vào cơ sở dữ liệu qua những cơ chế kiểm tra tính toàn vẹn nào?',
      'Điểm nghẽn cổ chai (Bottleneck) lớn nhất trong toàn bộ chuỗi luồng dữ liệu hiện tại nằm ở bước nào và độ trễ ở bước đó chiếm bao nhiêu %?',
    ],
    tech_core_vs_api: [
      'Đâu là phần giải thuật hay công nghệ do chính sinh viên trong nhóm tự nghiên cứu thiết kế, và đâu là phần phụ thuộc vào API của bên thứ ba?',
      'Nếu nhà cung cấp dịch vụ hoặc thư viện bên ngoài tăng giá gấp 3 lần hoặc ngừng cung cấp, nhóm có tự chủ công nghệ để thay thế được không?',
      'Hàm logic phức tạp nhất trong mã nguồn của nhóm là gì, và thuật toán đó giải quyết bài toán tối ưu nào mà thư viện có sẵn không làm được?',
      'Tỷ lệ mã nguồn tự viết so với mã tích hợp từ framework/thư viện mã nguồn mở là bao nhiêu phần trăm?',
    ],
    tech_offline_fallback: [
      'Khi thiết bị người dùng bị mất kết nối mạng hoặc API bên thứ ba gặp sự cố, hệ thống có cơ chế bộ đệm Offline nào để không làm gián đoạn trải nghiệm?',
      'Kiến trúc của nhóm xử lý ngoại lệ mất kết nối như thế nào, và dữ liệu phát sinh ngoại tuyến được đồng bộ ngược lại máy chủ ra sao khi có mạng?',
      'Cơ chế giải quyết xung đột dữ liệu (Conflict Resolution) khi nhiều thiết bị cùng đồng bộ sau thời gian offline được thiết kế theo giải thuật nào?',
      'Bộ nhớ đệm cục bộ (Local Storage/Cache) có giới hạn dung lượng bao nhiêu MB và lưu giữ được dữ liệu hoạt động trong bao lâu khi mất mạng hoàn toàn?',
    ],
    tech_edge_case_handling: [
      'Hệ thống xử lý ra sao khi gặp dữ liệu đầu vào bị rác, mờ, thiếu trường hoặc người dùng cố tình thao tác sai kịch bản chuẩn?',
      'Nhóm đã thử nghiệm hệ thống trong điều kiện môi trường thực tế bị nhiễu sóng hoặc ánh sáng kém chưa, và độ suy giảm hiệu năng là bao nhiêu %?',
      'Nếu người dùng nhập dữ liệu độc hại nhằm tấn công SQL Injection hoặc tràn bộ đệm, lớp phòng thủ đầu vào của nhóm chặn lại như thế nào?',
      'Kịch bản xử lý lỗi khi mô hình AI trả về câu trả lời sai lệch thông tin nghiêm trọng được thiết kế ra sao để không ảnh hưởng trực tiếp đến người dùng?',
    ],
    tech_empirical_metrics: [
      'Nhóm đã kiểm thử thực nghiệm trên bao nhiêu mẫu dữ liệu thật, và thông số độ trễ đo đạc thực tế (P95) cùng mức tải RAM là bao nhiêu?',
      'Độ chính xác và thời gian phản hồi của hệ thống khi chạy trên các thiết bị phần cứng thực tế đạt được con số cụ thể là bao nhiêu?',
      'Chỉ số đo lường hiệu năng kỹ thuật nào chứng minh sản phẩm của nhóm đáp ứng được tiêu chuẩn sử dụng thương mại ngoài phòng thí nghiệm?',
      'Nhóm đã đo đạc mức tiêu hao pin và dung lượng băng thông mạng trung bình cho mỗi phiên sử dụng của người dùng chưa?',
    ],
    tech_scalability_load: [
      'Nếu cùng lúc có 500 đến 1000 người dùng đồng thời truy cập, hệ thống của nhóm sẽ nghẽn ở đâu: cơ sở dữ liệu, băng thông hay thuật toán xử lý?',
      'Kiến trúc máy chủ của nhóm đã được kiểm thử tải (stress test) đến ngưỡng nào, và phương án mở rộng tài nguyên tự động ra sao?',
      'Nhóm sử dụng giải pháp kiến trúc nào (ví dụ: Message Queue, Microservices, Caching Layer) để phân tải khi có sự cố nghẽn lưu lượng?',
      'Chi phí hạ tầng máy chủ sẽ tăng theo cấp số nhân hay tuyến tính khi lượng người dùng tăng từ 1.000 lên 50.000 người?',
    ],
    tech_security_privacy: [
      'Dữ liệu nhạy cảm của người dùng được mã hóa và bảo vệ như thế nào để ngăn chặn nguy cơ rò rỉ hoặc bị đánh cắp thông tin?',
      'Cơ chế phân quyền và kiểm soát truy cập trong hệ thống được thiết kế ra sao để đảm bảo an toàn thông tin theo quy định pháp luật?',
      'Chính sách bảo mật và sao lưu dữ liệu dự phòng (Disaster Recovery) của hệ thống được thực hiện định kỳ theo tần suất nào?',
      'Nhóm đã quét lỗ hổng bảo mật bằng công cụ tự động nào chưa và phát hiện ra bao nhiêu điểm yếu cần khắc phục trước khi ra mắt?',
    ],
    tech_hardware_integration: [
      'Ứng dụng của nhóm đòi hỏi cấu hình phần cứng tối thiểu như thế nào, và có thể chạy mượt mà trên các thiết bị đời cũ của người dùng không?',
      'Khả năng tương thích và tích hợp của giải pháp vào hạ tầng thiết bị sẵn có của khách hàng đòi hỏi chi phí lắp đặt thêm là bao nhiêu?',
      'Giao thức kết nối giữa phần mềm và thiết bị ngoại vi (Bluetooth, Wifi, USB, MQTT) có đảm bảo duy trì kết nối ổn định trong môi trường công nghiệp không?',
      'Nếu thiết bị phần cứng của khách hàng chạy hệ điều hành khác nhau (Android, iOS, Windows, Linux), nhóm đã tối ưu hóa tương thích đa nền tảng ra sao?',
    ],

    // 3. GS. Vũ Hoàng (Finance Dragon)
    fin_mvp_budget: [
      'Số tiền tối thiểu để nhóm hoàn thiện bản thử nghiệm MVP chạy thật là bao nhiêu tiền, và nguồn kinh phí đó được nhóm lấy từ đâu?',
      'Trong các hạng mục chi phí làm sản phẩm ban đầu, khoản chi nào chiếm tỷ trọng lớn nhất và nhóm đã tối ưu nó như thế nào?',
      'Nhóm đã dự trù khoản chi phí mua bản quyền công cụ, thuê máy chủ đám mây và chứng chỉ bảo mật trong 3 tháng thử nghiệm đầu tiên chưa?',
      'Nếu kinh phí nghiên cứu bị thiếu hụt 30% so với dự toán, nhóm sẽ cắt bỏ những hạng mục nào trước tiên mà không làm hỏng tính năng cốt lõi?',
    ],
    fin_monthly_opex: [
      'Chi phí cố định hàng tháng (máy chủ, tên miền, API, vận hành) để duy trì hệ thống là bao nhiêu tiền, và nhóm lấy nguồn nào bù đắp khi chưa có doanh thu?',
      'Nếu trong 6 tháng đầu chưa có khách hàng trả phí, chi phí tối thiểu để giữ hệ thống sống sót là bao nhiêu và nhóm tự duy trì được bao lâu?',
      'Phân tách cụ thể các khoản định phí và biến phí hàng tháng: mỗi một người dùng mới phát sinh thêm bao nhiêu chi phí máy chủ và dữ liệu?',
      'Nhóm có chính sách hỗ trợ thù lao cho các thành viên trong nhóm không hay tất cả đều làm thiện nguyện không lương trong 6 tháng đầu?',
    ],
    fin_break_even_volume: [
      'Nhóm cần bán được bao nhiêu sản phẩm hoặc có bao nhiêu tài khoản trả phí mỗi tháng để đạt điểm hòa vốn tự trang trải chi phí?',
      'Căn cứ vào đâu để nhóm tính ra sản lượng hòa vốn đó, và mất bao nhiêu tháng nhóm dự kiến sẽ chạm tới cột mốc này?',
      'Nếu doanh số chỉ đạt 50% so với kế hoạch hòa vốn, điểm hòa vốn sẽ bị lùi lại bao nhiêu tháng và nhóm có phương án bù đắp tài chính nào?',
      'Số lượng khách hàng hòa vốn chiếm bao nhiêu phần trăm tổng dung lượng thị trường mục tiêu ban đầu của nhóm?',
    ],
    fin_unit_pricing: [
      'Cơ sở định lượng nào để nhóm đưa ra mức giá bán này, và người dùng tiết kiệm hoặc kiếm thêm được bao nhiêu tiền khi chi trả cho nhóm?',
      'Sau khi trừ đi giá vốn và chi phí trực tiếp trên mỗi đơn vị dịch vụ, nhóm còn lại biên lợi nhuận gộp là bao nhiêu phần trăm?',
      'Mức giá này có linh hoạt theo các gói tính năng khác nhau không, và nhóm có gói miễn phí (Freemium) để thu hút người dùng ban đầu không?',
      'Nhóm đã so sánh giá bán của mình với giải pháp thay thế của đối thủ chưa: giá của nhóm rẻ hơn nhờ tối ưu kỹ thuật hay chấp nhận bán lỗ để lấy thị phần?',
    ],
    fin_bootstrap_runway: [
      'Kế hoạch tài chính tự lực (Bootstrapping) của nhóm trong 6 tháng đầu gồm những kịch bản cắt giảm chi phí sinh tồn nào khi chưa có nhà đầu tư?',
      'Nhóm có quỹ dự phòng khẩn cấp bao nhiêu tiền, và nếu ngân sách cạn kiệt thì dự án sẽ tiếp tục bằng cách nào?',
      'Thời gian sống sót tối đa (Runway) của dự án với nguồn vốn hiện có là bao nhiêu tháng nếu không nhận được thêm bất kỳ khoản tiền tài trợ nào?',
      'Nếu phải lựa chọn giữa duy trì hệ thống chạy cầm chừng và dừng dự án để bảo toàn vốn cá nhân, nhóm có tiêu chí dừng cuộc chơi (Kill criteria) rõ ràng chưa?',
    ],
    fin_revenue_streams: [
      'Cấu trúc dòng tiền thu về của nhóm đến từ những nguồn nào cụ thể: thu phí một lần, gói thuê bao định kỳ hay hoa hồng dịch vụ?',
      'Nguồn thu nào sẽ đóng góp hơn 70% doanh thu của dự án trong năm đầu tiên, và cơ chế thu tiền thực tế diễn ra như thế nào?',
      'Kỳ hạn thanh toán của khách hàng (thu tiền trước hay trả sau theo tháng) ảnh hưởng đến dòng tiền lưu động của nhóm như thế nào?',
      'Dự án có nguồn thu phụ nào từ việc bán dữ liệu phân tích ẩn danh, dịch vụ tùy biến theo yêu cầu hay đào tạo triển khai không?',
    ],
    fin_capital_efficiency: [
      'Nếu nhận được giải thưởng hoặc tiền tài trợ 30-50 triệu từ cuộc thi, nhóm sẽ phân bổ từng khoản tiền vào những việc gì để đạt hiệu quả cao nhất?',
      'Khoản tiền tài trợ ban đầu sẽ giúp nhóm đạt được cột mốc kiểm chứng kỹ thuật hay kinh doanh cụ thể nào trước khi cần thêm vốn?',
      'Hiệu suất sử dụng vốn (ROI) được đo lường bằng chỉ số định lượng nào sau 6 tháng tiêu hết khoản tiền tài trợ đó?',
      'Nhóm có mở tài khoản ngân hàng riêng cho dự án và quy chế minh bạch tài chính giữa các thành viên sáng lập như thế nào?',
    ],
    fin_financial_risk_hedge: [
      'Khi chi phí API hoặc dịch vụ hạ tầng tăng vọt ngoài dự tính do lượng người dùng tăng, nhóm có phương án tài chính dự phòng nào để không bị lỗ nặng?',
      'Nhóm đã tính toán rủi ro biến động giá nguyên vật liệu hoặc chi phí đối tác bên ngoài vào bài toán tài chính chưa?',
      'Nếu tỷ lệ bùng tiền hoặc hủy đăng ký dịch vụ của khách hàng lên tới 20%, mô hình tài chính của nhóm có bị sụp đổ không?',
      'Phương án dự phòng khi khách hàng doanh nghiệp chậm thanh toán từ 60 đến 90 ngày được nhóm xử lý dòng tiền ra sao?',
    ],

    // 4. ThS. Đặng Mai Lan (Risk Strategist)
    risk_defense_moat: [
      'Rào cản phòng thủ nào giúp nhóm bảo vệ thành quả nếu một đối thủ lớn có sẵn tiềm lực tài chính tung ra tính năng tương tự trong 2 tuần?',
      'Điểm khác biệt độc quyền không thể sao chép của nhóm nằm ở đâu: dữ liệu bản địa, thuật toán độc quyền hay mạng lưới quan hệ khách hàng?',
      'Nhóm có hiệu ứng mạng lưới (Network Effect) hoặc chi phí chuyển đổi (Switching Cost) nào đủ cao để giữ chân người dùng trước các đợt khuyến mãi của đối thủ?',
      'Nếu mã nguồn mở hoặc một nhóm sinh viên khác sao chép 90% giao diện và tính năng của nhóm, khách hàng sẽ ở lại vì giá trị độc quyền nào?',
    ],
    risk_graduation_cliff: [
      'Sau cuộc thi hoặc vài tháng nữa khi các thành viên tốt nghiệp ra trường đi làm công ty, ai sẽ tiếp tục duy trì dự án hay đề tài sẽ bị bỏ xó?',
      'Cơ chế cam kết thời gian và phân chia quyền lợi giữa các sáng lập viên được nhóm thống nhất như thế nào để tránh tan rã đội ngũ?',
      'Thỏa thuận sáng lập (Founders Agreement) đã được ký kết văn bản về tỷ lệ cổ phần, thời gian cống hiến tối thiểu và điều khoản vesting chưa?',
      'Nếu trưởng nhóm kỹ thuật hoặc người nắm giữ thuật toán cốt lõi xin rút lui, dự án có quy trình chuyển giao tài liệu và tiếp quản công nghệ ra sao?',
    ],
    risk_ip_copyright: [
      'Nhóm đã có kế hoạch đăng ký bản quyền tác giả phần mềm, nhãn hiệu hoặc giải pháp hữu ích chưa để tránh bị tranh chấp sở hữu trí tuệ?',
      'Dữ liệu và thuật toán nhóm sử dụng có nguy cơ vi phạm điều khoản bản quyền của bên thứ ba nào không, và nhóm kiểm soát điều này ra sao?',
      'Các tài sản sở hữu trí tuệ nghiên cứu trong trường đại học thuộc quyền sở hữu của nhóm sinh viên hay thuộc về nhà trường và giảng viên hướng dẫn?',
      'Nhóm đã tra cứu cơ sở dữ liệu sáng chế và nhãn hiệu của Cục Sở hữu Trí tuệ để chắc chắn tên thương hiệu của mình không bị trùng lặp chưa?',
    ],
    risk_pilot_roadmap: [
      'Kế hoạch kiểm chứng thực địa trong 3-6 tháng tới gồm những cột mốc định lượng nào, và đơn vị nào đã đồng ý cho nhóm thử nghiệm pilot?',
      'Tiêu chí cụ thể nào để nhóm xác nhận một đợt thử nghiệm pilot là thành công trước khi triển khai trên diện rộng?',
      'Thời gian triển khai một đợt pilot mất bao nhiêu tuần, và chi phí phát sinh để hỗ trợ khách hàng thử nghiệm lấy từ nguồn nào?',
      'Nếu kết quả pilot không đạt kỳ vọng ban đầu, nhóm có kế hoạch thu thập phản hồi và cải tiến sản phẩm theo vòng lặp bao nhiêu ngày?',
    ],
    risk_competitive_comparison: [
      'Điểm yếu chí mạng nhất của giải pháp nhóm khi đặt cạnh đối thủ dẫn đầu thị trường là gì, và nhóm làm thế nào để người dùng không bỏ đi?',
      'Bảng so sánh tính năng trực diện của nhóm với các giải pháp hiện nay cho thấy nhóm vượt trội ở những khía cạnh thực tế nào?',
      'Đối thủ cạnh tranh gián tiếp lớn nhất mà nhóm chưa đề cập trong bài thuyết trình là ai, và họ có thể tiêu diệt giải pháp này theo cách nào?',
      'Khách hàng có thể phàn nàn về điều gì nhiều nhất khi chuyển từ giải pháp của đối thủ sang sản phẩm của nhóm?',
    ],
    risk_market_shifts: [
      'Nếu tệp khách hàng ban đầu từ chối sử dụng sản phẩm sau 3 tháng thử nghiệm, nhóm có kịch bản chuyển hướng (Pivot) dự phòng nào?',
      'Các biến động về chính sách hoặc thị trường tiêu cực nào có thể ảnh hưởng trực tiếp đến sự tồn tại của mô hình kinh doanh này?',
      'Kế hoạch thích ứng khi các nền tảng lớn (Google, Apple, Meta) cập nhật thuật toán hoặc chính sách quyền riêng tư ảnh hưởng đến sản phẩm là gì?',
      'Dự án đã kiểm tra tính bền vững của nhu cầu thị trường sau khi cơn sốt công nghệ hiện tại lắng xuống chưa?',
    ],
    risk_legal_compliance: [
      'Dự án có thuộc ngành nghề kinh doanh có điều kiện hoặc yêu cầu giấy phép chuyên ngành nào không, và nhóm xử lý hành lang pháp lý này ra sao?',
      'Quy định về bảo vệ dữ liệu cá nhân theo Nghị định 13 được nhóm tuân thủ như thế nào trong quá trình thu thập thông tin người dùng?',
      'Điều khoản dịch vụ và chính sách miễn trừ trách nhiệm pháp lý khi hệ thống xảy ra sự cố kỹ thuật đã được soạn thảo kỹ lưỡng chưa?',
      'Nếu sản phẩm liên quan đến y tế, giáo dục hoặc tài chính, nhóm đã chuẩn bị các giấy tờ kiểm định và chứng nhận hợp quy cần thiết nào?',
    ],
    risk_team_skill_gaps: [
      'Đội ngũ của nhóm hiện đang thiếu hụt kỹ năng quan trọng nào nhất, và nhóm có kế hoạch tìm kiếm cố vấn hay bổ sung nhân sự ra sao?',
      'Sự phân công trách nhiệm giữa các thành viên kỹ thuật và kinh doanh trong 6 tháng tới được định lượng bằng những KPI cụ thể nào?',
      'Nhóm đã có cố vấn chuyên môn (Advisor/Mentor) trong ngành hướng dẫn thực tế chưa, và họ hỗ trợ nhóm những nguồn lực gì?',
      'Kế hoạch đào tạo nâng cao năng lực cho các thành viên trong nhóm để theo kịp tốc độ phát triển của dự án được thực hiện như thế nào?',
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
    resolvedQAPairs?: Array<{ bossName?: string; question: string; candidateAnswer: string }>,
    onChunk?: (c: string) => void,
    onComplete?: (t: string) => void
  ): Promise<string> {
    this.logger.log(
      `[FALLBACK] 🔄 Đang tạo câu hỏi Fallback mô phỏng cho Giám khảo ${persona.name} | Chủ đề: ${topic || 'Tổng quát'} [ID: ${topicId || 'N/A'}] | Preset: ${preset || 'SV_STARTUP'}`
    );
    let fallbackText = '';

    const pickRandom = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

    const isAlreadyAsked = (q: string): boolean => {
      const snippet = q.slice(0, 35).toLowerCase();
      if (previousQuestions && previousQuestions.length > 0) {
        const matchedPrev = previousQuestions.some((prev) => {
          const p = prev?.trim().toLowerCase();
          if (!p || p.length < 10) return false;
          return p.includes(snippet) || (p.length >= 35 && snippet.includes(p.slice(0, 35)));
        });
        if (matchedPrev) return true;
      }
      if (resolvedQAPairs && resolvedQAPairs.length > 0) {
        const matchedResolved = resolvedQAPairs.some((pair) => {
          const p = pair?.question?.trim().toLowerCase();
          if (!p || p.length < 10) return false;
          return p.includes(snippet) || (p.length >= 35 && snippet.includes(p.slice(0, 35)));
        });
        if (matchedResolved) return true;
      }
      return false;
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
      } else {
        // 3. Fallback theo Boss chung nếu các câu trong chủ đề đã dùng hết hoặc không match chủ đề
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
        if (availableGeneral.length > 0) {
          fallbackText = pickRandom(availableGeneral);
        } else if (topicCandidates.length > 0) {
          fallbackText = pickRandom(topicCandidates);
        } else {
          fallbackText = pickRandom(bossGeneralCandidates);
        }
      }
    }

    if (!fallbackText) {
      fallbackText = 'Bạn có thể chia sẻ cụ thể hơn về kế hoạch triển khai thực tế của đề án trong thời gian tới không?';
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
