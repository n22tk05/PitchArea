import { Injectable, Logger } from '@nestjs/common';
import { GeminiService } from '../../adapters/llm/gemini.service';
import { RAGMatchResult } from './rag-engine.service';
import { EvaluationPreset } from '@pitcharena/shared';

export interface ProsecutorOpinion {
  isVague: boolean;
  evasionDetected: boolean;
  attitudeScore: number; // 0 (cãi cùn) -> 100 (thẳng thắn)
  directnessScore: number; // 0 - 100
  critique: string;
}

export interface DefenderOpinion {
  mitigatingFactors: string[];
  honestyScore: number;    // 0 - 100
  factualScore: number;    // 0 - 100
  defenseArgument: string;
}

export interface MADChamberOutput {
  prosecutor: ProsecutorOpinion;
  defender: DefenderOpinion;
  isCircuitBreakerTriggered: boolean;
  latencyMs: number;
}

@Injectable()
export class MADChamberService {
  private readonly logger = new Logger(MADChamberService.name);

  constructor(private readonly geminiService: GeminiService) {}

  /**
   * Kích hoạt phiên tranh biện kín đa tác nhân (Prosecutor vs Defender) với Circuit Breaker 600ms
   */
  public async deliberate(
    question: string,
    candidateSpeech: string,
    ragMatch: RAGMatchResult,
    preset?: EvaluationPreset
  ): Promise<MADChamberOutput> {
    const startTime = Date.now();
    const CIRCUIT_BREAKER_TIMEOUT_MS = 600;

    try {
      // Chạy song song cả Prosecutor và Defender với Promise.race bảo vệ bởi timeout
      const chamberPromise = Promise.all([
        this.runProsecutor(question, candidateSpeech, ragMatch, preset),
        this.runDefender(question, candidateSpeech, ragMatch, preset),
      ]);

      const timeoutPromise = new Promise<'TIMEOUT'>((resolve) =>
        setTimeout(() => resolve('TIMEOUT'), CIRCUIT_BREAKER_TIMEOUT_MS)
      );

      const result = await Promise.race([chamberPromise, timeoutPromise]);

      if (result === 'TIMEOUT') {
        this.logger.warn(`[Circuit Breaker 600ms] LLM trễ quá ngưỡng! Lập tức kích hoạt Fallback Heuristic.`);
        return this.getFallbackChamberOutput(candidateSpeech, ragMatch, startTime, true);
      }

      const [prosecutor, defender] = result;
      const latencyMs = Date.now() - startTime;

      this.logger.log(`\n================== [MAD CHAMBER TRANH BIỆN KÍN] (${latencyMs}ms) ==================`);
      this.logger.log(`⚖️ [CÔNG TỐ VIÊN (Prosecutor)]: "${prosecutor.critique}"`);
      this.logger.log(`   └─ Trọng tâm: ${prosecutor.directnessScore}/100 | Né tránh: ${prosecutor.evasionDetected ? 'CÓ' : 'KHÔNG'} | Thái độ: ${prosecutor.attitudeScore}/100`);
      this.logger.log(`🛡️ [NGƯỜI BÀO CHỮA (Defender)]: "${defender.defenseArgument}"`);
      this.logger.log(`   └─ Căn cứ tài liệu: ${defender.factualScore}/100 | Trung thực: ${defender.honestyScore}/100 | In Dubio Pro Reo: ${ragMatch.inDubioProReoApplied ? 'KÍCH HOẠT' : 'KHÔNG'}`);
      this.logger.log(`===============================================================================\n`);

      return {
        prosecutor,
        defender,
        isCircuitBreakerTriggered: false,
        latencyMs,
      };
    } catch (err: any) {
      this.logger.error(`[MAD Chamber] Lỗi khi chạy LLM: ${err.message}. Kích hoạt Fallback.`);
      return this.getFallbackChamberOutput(candidateSpeech, ragMatch, startTime, true);
    }
  }

  /**
   * 1. Công tố viên (Prosecutor): Tìm lỗi logic, ngụy biện, né tránh
   */
  private async runProsecutor(
    question: string,
    speech: string,
    rag: RAGMatchResult,
    preset?: EvaluationPreset
  ): Promise<ProsecutorOpinion> {
    const speechTrimmed = speech.trim();
    const speechLower = speechTrimmed.toLowerCase();
    const words = speechTrimmed ? speechTrimmed.split(/\s+/) : [];

    // Trường hợp thí sinh hoàn toàn không phản hồi hoặc chủ động bỏ qua câu hỏi
    const isNoResponse =
      words.length === 0 ||
      words.length < 3 ||
      speechLower.includes('không phản hồi') ||
      speechLower.includes('bỏ qua câu hỏi') ||
      speechLower.includes('kết thúc đối chất');

    if (isNoResponse) {
      return {
        isVague: true,
        evasionDetected: true,
        attitudeScore: 10,
        directnessScore: 10,
        critique: 'Thí sinh không phản hồi hoặc né tránh câu hỏi chất vấn của Giám khảo.',
      };
    }

    // 1. Kiểm tra câu bị cắt ngang giữa chừng khi hết giờ (Unfinished / Trailing speech)
    // Ví dụ kết thúc bằng: "và", "thì", "mà", "là", "như là", "ở", "đọc vào và"
    const trailingPatterns = [
      /\b(và|hoặc|thì|mà|là|ở|vào|ra|của|để|với|tới|do|vì|khi|như|ví dụ như|cụ thể là|nghĩa là|chúng ta sẽ|nhóm em sẽ)\s*$/i,
      /\b(đang|sẽ|được|có thể|trong khi|sau khi)\s*$/i,
    ];
    const isTrailingUnfinished = trailingPatterns.some((pattern) => pattern.test(speechTrimmed));

    // 2. Kiểm tra lặp từ liên tiếp do ấp úng, lắp bắp (ví dụ: "giấy giấy tờ", "hạ tầng hạ tầng")
    const stutterMatches = speechTrimmed.match(/\b([\p{L}\d]+)\s+\1\b/giu) || [];
    const hasStutter = stutterMatches.length > 0;

    // 3. Kiểm tra cụm từ đệm / rác ngữ cảnh (Rambling & Filler phrases)
    const fillerPhrases = [
      'rồi thì',
      'để từ',
      'mà nó tới',
      'thì nó sẽ có',
      'đúng như sau',
      'đầu tiên thì khi mà',
      'ví dụ như là chúng ta sẽ',
      'ví dụ như là',
      'kiểu như là',
      'như kiểu là',
      'thực ra thì',
      'nói chung là',
      'ở cái chỗ là',
    ];
    let fillerCount = 0;
    for (const fp of fillerPhrases) {
      if (speechLower.includes(fp)) fillerCount++;
    }
    const hasNumbers = rag.supportedNumbers.length > 0 || /\d+/.test(speechTrimmed);
    const isRambling = fillerCount >= 2 || (hasStutter && words.length > 15 && !hasNumbers);

    // Dấu hiệu cãi cùn / né tránh: "tất nhiên là", "ai cũng biết", "chắc chắn sẽ", "nhóm em nghĩ là"
    const evasionKeywords = ['ai cũng biết', 'đương nhiên', 'chắc chắn là', 'em nghĩ là', 'sau này sẽ', 'tùy trường hợp'];
    const evasionDetected = evasionKeywords.some((kw) => speechLower.includes(kw)) || isRambling;

    // Dấu hiệu cầu thị: "nhóm em xin tiếp thu", "đây là thiếu sót", "nhóm đã thử nghiệm", "số liệu thực tế là"
    const honestKeywords = ['tiếp thu', 'thiếu sót', 'thực tế khảo sát', 'số liệu hiện tại', 'đang hoàn thiện'];
    const hasHonesty = honestKeywords.some((kw) => speechLower.includes(kw));

    const isShort = words.length < 15;
    const isVague = isShort || isTrailingUnfinished || (!rag.hasFactualSupport && evasionDetected);

    let directnessScore = 55;
    if (isShort) directnessScore -= 20;
    if (isTrailingUnfinished) directnessScore -= 25; // Trừ nặng vì câu chưa hoàn thành
    if (isRambling) directnessScore -= 20;           // Trừ vì nói vòng vo từ đệm
    if (hasStutter) directnessScore -= 10;           // Trừ vì lặp từ lắp bắp
    if (!hasNumbers) directnessScore -= 10;          // Trừ vì thiếu số liệu định lượng
    if (rag.hasFactualSupport) directnessScore += 15;
    if (evasionDetected) directnessScore -= 15;

    let attitudeScore = 60;
    if (hasHonesty) attitudeScore = 90;
    else if (isRambling || hasStutter) attitudeScore = 35;
    else if (evasionDetected) attitudeScore = 30;

    let critique = 'Thí sinh đối diện trực tiếp với câu hỏi.';
    if (isTrailingUnfinished) {
      critique = `Câu trả lời bị ngắt giữa chừng ("...${speechTrimmed.slice(-30)}"), chưa hoàn thiện luận điểm và thiếu giải pháp cụ thể.`;
    } else if (isRambling || hasStutter) {
      critique = `Thí sinh nói vòng vo, lặp từ (${stutterMatches.slice(0, 2).join(', ') || 'ấp úng'}), nhiều từ đệm và thiếu hoàn toàn số liệu chứng minh.`;
    } else if (evasionDetected) {
      critique = 'Thí sinh có dấu hiệu trả lời nước đôi hoặc né tránh số liệu cụ thể.';
    } else if (isVague) {
      critique = 'Câu trả lời còn quá ngắn hoặc chung chung, chưa chạm đến trọng tâm.';
    }

    return {
      isVague,
      evasionDetected,
      attitudeScore: Math.min(100, Math.max(10, attitudeScore)),
      directnessScore: Math.min(100, Math.max(15, directnessScore)),
      critique,
    };
  }

  /**
   * 2. Người bào chữa (Defender): Tìm điểm mạnh, suy đoán vô tội
   */
  private async runDefender(
    question: string,
    speech: string,
    rag: RAGMatchResult,
    preset?: EvaluationPreset
  ): Promise<DefenderOpinion> {
    const speechTrimmed = speech.trim();
    const speechLower = speechTrimmed.toLowerCase();
    const words = speechTrimmed ? speechTrimmed.split(/\s+/) : [];

    const isNoResponse =
      words.length === 0 ||
      words.length < 3 ||
      speechLower.includes('không phản hồi') ||
      speechLower.includes('bỏ qua câu hỏi') ||
      speechLower.includes('kết thúc đối chất');

    if (isNoResponse) {
      return {
        mitigatingFactors: [],
        honestyScore: 20,
        factualScore: 10,
        defenseArgument: 'Không thể ghi nhận căn cứ bào chữa do thí sinh không đưa ra câu trả lời cho câu hỏi này.',
      };
    }

    const trailingPatterns = [
      /\b(và|hoặc|thì|mà|là|ở|vào|ra|của|để|với|tới|do|vì|khi|như|ví dụ như|cụ thể là|nghĩa là|chúng ta sẽ|nhóm em sẽ)\s*$/i,
      /\b(đang|sẽ|được|có thể|trong khi|sau khi)\s*$/i,
    ];
    const isTrailingUnfinished = trailingPatterns.some((pattern) => pattern.test(speechTrimmed));
    const hasNumbers = rag.supportedNumbers.length > 0 || /\d+/.test(speechTrimmed);
    const stutterMatches = speechTrimmed.match(/\b([\p{L}\d]+)\s+\1\b/giu) || [];
    const hasStutter = stutterMatches.length > 0;

    const mitigatingFactors: string[] = [];
    let factualScore = rag.relevanceScore;
    let honestyScore = 55;

    // Nếu không có bất kỳ con số cụ thể nào thì căn cứ tài liệu không thể vượt quá 35 điểm
    if (!hasNumbers) {
      factualScore = Math.min(35, factualScore);
    }

    if (rag.inDubioProReoApplied) {
      mitigatingFactors.push('Áp dụng suy đoán vô tội: Số liệu được xác thực từ đề mục chéo trong tài liệu');
      factualScore = Math.max(75, factualScore);
    }

    if (rag.supportedNumbers.length > 0) {
      mitigatingFactors.push(`Thí sinh đưa ra số liệu rõ ràng có kiểm chứng (${rag.supportedNumbers.join(', ')})`);
      factualScore += 15;
    }

    // CHỈ cộng điểm nỗ lực diễn đạt khi câu KHÔNG bị ngắt dở dang và KHÔNG lắp bắp vòng vo
    if (words.length >= 25 && !isTrailingUnfinished && !hasStutter) {
      mitigatingFactors.push('Thí sinh diễn đạt mạch lạc, nỗ lực giải trình chi tiết');
      honestyScore += 15;
    } else if (isTrailingUnfinished || hasStutter) {
      honestyScore = 35; // Bị ngắt dở hoặc lắp bắp vòng vo
    }

    let defenseArgument = 'Thí sinh có tinh thần cầu thị và nỗ lực phản biện.';
    if (isTrailingUnfinished) {
      defenseArgument = 'Ghi nhận nỗ lực trả lời nhưng câu nói bị cắt ngang khi hết giờ, chưa đủ dữ kiện kết luận.';
    } else if (mitigatingFactors.length > 0) {
      defenseArgument = mitigatingFactors.join('; ');
    } else if (!hasNumbers) {
      defenseArgument = 'Thí sinh trả lời nhưng chưa đưa ra được số liệu hay minh chứng thực tế.';
    }

    return {
      mitigatingFactors,
      honestyScore: Math.min(100, Math.max(20, honestyScore)),
      factualScore: Math.min(100, Math.max(15, factualScore)),
      defenseArgument,
    };
  }

  /**
   * Fallback tức thì khi Circuit Breaker nổ (thời gian xử lý < 5ms)
   */
  private getFallbackChamberOutput(
    speech: string,
    rag: RAGMatchResult,
    startTime: number,
    triggered: boolean
  ): MADChamberOutput {
    const speechTrimmed = speech.trim();
    const speechLower = speechTrimmed.toLowerCase();
    const words = speechTrimmed ? speechTrimmed.split(/\s+/) : [];
    const isNoResponse =
      words.length === 0 ||
      words.length < 3 ||
      speechLower.includes('không phản hồi') ||
      speechLower.includes('bỏ qua câu hỏi') ||
      speechLower.includes('kết thúc đối chất');

    if (isNoResponse) {
      return {
        prosecutor: {
          isVague: true,
          evasionDetected: true,
          attitudeScore: 10,
          directnessScore: 10,
          critique: 'Thí sinh không phản hồi hoặc né tránh câu hỏi chất vấn của Giám khảo.',
        },
        defender: {
          mitigatingFactors: [],
          honestyScore: 20,
          factualScore: 10,
          defenseArgument: 'Không thể ghi nhận căn cứ bào chữa do thí sinh không đưa ra câu trả lời cho câu hỏi này.',
        },
        isCircuitBreakerTriggered: triggered,
        latencyMs: Date.now() - startTime,
      };
    }

    const trailingPatterns = [
      /\b(và|hoặc|thì|mà|là|ở|vào|ra|của|để|với|tới|do|vì|khi|như|ví dụ như|cụ thể là|nghĩa là|chúng ta sẽ|nhóm em sẽ)\s*$/i,
      /\b(đang|sẽ|được|có thể|trong khi|sau khi)\s*$/i,
    ];
    const isTrailingUnfinished = trailingPatterns.some((pattern) => pattern.test(speechTrimmed));
    const stutterMatches = speechTrimmed.match(/\b([\p{L}\d]+)\s+\1\b/giu) || [];
    const hasStutter = stutterMatches.length > 0;
    const hasNumbers = rag.supportedNumbers.length > 0 || /\d+/.test(speechTrimmed);
    const wordCount = words.length;

    const prosecutor: ProsecutorOpinion = {
      isVague: isTrailingUnfinished || (wordCount < 15 && !hasNumbers),
      evasionDetected: hasStutter || !hasNumbers,
      attitudeScore: isTrailingUnfinished || hasStutter ? 35 : 65,
      directnessScore: isTrailingUnfinished ? 25 : hasStutter ? 35 : wordCount >= 20 ? 60 : 40,
      critique: isTrailingUnfinished
        ? 'Câu trả lời bị ngắt giữa chừng khi hết giờ, luận điểm chưa hoàn chỉnh.'
        : hasStutter
        ? 'Thí sinh diễn đạt lặp từ, nói vòng vo và thiếu số liệu cụ thể.'
        : '[Fallback Heuristic] Đánh giá theo mật độ thông tin và căn cứ tài liệu.',
    };

    const defender: DefenderOpinion = {
      mitigatingFactors: rag.inDubioProReoApplied
        ? ['[In Dubio Pro Reo] Được bảo lưu điểm nhờ số liệu chéo trong tài liệu']
        : hasNumbers
        ? ['Thí sinh có trích dẫn số liệu liên quan']
        : [],
      honestyScore: isTrailingUnfinished || hasStutter ? 35 : 60,
      factualScore: hasNumbers ? rag.relevanceScore : Math.min(35, rag.relevanceScore),
      defenseArgument: isTrailingUnfinished
        ? 'Ghi nhận nỗ lực đối chất nhưng câu nói chưa hoàn chỉnh.'
        : '[Fallback Heuristic] Ghi nhận nỗ lực đối chất của thí sinh.',
    };

    this.logger.log(`\n================== [MAD CHAMBER FALLBACK HEURISTIC] ==================`);
    this.logger.log(`⚖️ [CÔNG TỐ VIÊN (Fallback)]: "${prosecutor.critique}"`);
    this.logger.log(`🛡️ [NGƯỜI BÀO CHỮA (Fallback)]: "${defender.defenseArgument}"`);
    this.logger.log(`======================================================================\n`);

    return {
      prosecutor,
      defender,
      isCircuitBreakerTriggered: triggered,
      latencyMs: Date.now() - startTime,
    };
  }
}
