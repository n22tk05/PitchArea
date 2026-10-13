import { Injectable, Logger } from '@nestjs/common';
import { GeminiService } from '../../adapters/llm/gemini.service';
import { RAGMatchResult } from './rag-engine.service';
import { EvaluationPreset } from '@pitcharena/shared';
import {
  buildProsecutorPrompt,
  buildDefenderPrompt,
} from '../../adapters/llm/prompt-templates';

export interface ProsecutorOpinion {
  isVague: boolean;
  evasionDetected: boolean;
  attitudeScore: number; // 0 (cãi cùn) -> 100 (thẳng thắn)
  directnessScore: number; // 0 - 100
  isVerbose?: boolean; // Thí sinh nói có nội dung nhưng hết 30s chưa dứt câu (quá dài, không phải né tránh)
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
   * Kích hoạt phiên tranh biện kín đa tác nhân (Prosecutor vs Defender) với Circuit Breaker 2500ms
   */
  public async deliberate(
    question: string,
    candidateSpeech: string,
    ragMatch: RAGMatchResult,
    preset?: EvaluationPreset
  ): Promise<MADChamberOutput> {
    const startTime = Date.now();
    const CIRCUIT_BREAKER_TIMEOUT_MS = 2500;

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
        this.logger.warn(`[Circuit Breaker 2500ms] LLM trễ quá ngưỡng! Lập tức kích hoạt Fallback Heuristic.`);
        return this.getFallbackChamberOutput(candidateSpeech, ragMatch, startTime, true);
      }

      const [prosecutor, defender] = result;
      const latencyMs = Date.now() - startTime;

      this.logger.log(`\n================== [MAD CHAMBER TRANH BIỆN KÍN] (${latencyMs}ms) ==================`);
      this.logger.log(`⚖️ [CÔNG TỐ VIÊN (Prosecutor)]: "${prosecutor.critique}"`);
      this.logger.log(
        `   └─ Trọng tâm: ${prosecutor.directnessScore}/100 | Quá dài (Verbose): ${prosecutor.isVerbose ? 'CÓ' : 'KHÔNG'} | Né tránh: ${prosecutor.evasionDetected ? 'CÓ' : 'KHÔNG'} | Thái độ: ${prosecutor.attitudeScore}/100`
      );
      this.logger.log(`🛡️ [NGƯỜI BÀO CHỮA (Defender)]: "${defender.defenseArgument}"`);
      this.logger.log(
        `   └─ Căn cứ tài liệu: ${defender.factualScore}/100 | Trung thực: ${defender.honestyScore}/100 | In Dubio Pro Reo: ${ragMatch.inDubioProReoApplied ? 'KÍCH HOẠT' : 'KHÔNG'}`
      );
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
   * 1. Công tố viên (Prosecutor): Phân loại DIRECT vs VERBOSE vs EVASION qua LLM
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
        isVerbose: false,
        attitudeScore: 10,
        directnessScore: 10,
        critique: 'Thí sinh không phản hồi hoặc né tránh câu hỏi chất vấn của Giám khảo.',
      };
    }

    // GỌI LLM GROQ / GEMINI QUA PROMPT CHUYÊN BIỆT
    try {
      const ragContext = `Mục liên quan: ${rag.matchedSections.join(', ') || 'Đề án'}\nSố liệu kiểm chứng: ${rag.supportedNumbers.join(', ') || 'Không có'}`;
      const prompt = buildProsecutorPrompt(question, speechTrimmed, ragContext, preset);
      const completion = await this.geminiService.generateFastCompletion(prompt, 300);

      const jsonMatch = completion.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const directnessScore = Math.min(
          100,
          Math.max(10, typeof parsed.directnessScore === 'number' ? parsed.directnessScore : 50)
        );
        const isVerbose = Boolean(parsed.isVerbose);
        const isEvasion = Boolean(parsed.isEvasion);
        const attitudeScore = isEvasion ? 30 : isVerbose ? 75 : 85;

        return {
          isVague: isVerbose || isEvasion || directnessScore < 50,
          evasionDetected: isEvasion,
          isVerbose,
          attitudeScore,
          directnessScore,
          critique: parsed.critique || 'Công tố viên đánh giá trọng tâm câu trả lời.',
        };
      }
    } catch (llmErr: any) {
      this.logger.debug(`[runProsecutor] LLM gặp sự cố (${llmErr.message}), chuyển sang heuristic.`);
    }

    // Heuristic Fallback khi LLM không kịp phản hồi
    return this.fallbackProsecutorHeuristic(speechTrimmed, words, rag);
  }

  /**
   * 2. Người bào chữa (Defender): Tìm kiếm căn cứ, suy đoán vô tội qua LLM
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

    // GỌI LLM GROQ / GEMINI QUA PROMPT CHUYÊN BIỆT
    try {
      const ragContext = `Mục liên quan: ${rag.matchedSections.join(', ') || 'Đề án'}\nSố liệu kiểm chứng: ${rag.supportedNumbers.join(', ') || 'Không có'}`;
      const prompt = buildDefenderPrompt(question, speechTrimmed, ragContext, preset);
      const completion = await this.geminiService.generateFastCompletion(prompt, 300);

      const jsonMatch = completion.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        let factualScore = Math.min(
          100,
          Math.max(15, typeof parsed.factualScore === 'number' ? parsed.factualScore : 50)
        );
        let honestyScore = Math.min(
          100,
          Math.max(20, typeof parsed.honestyScore === 'number' ? parsed.honestyScore : 60)
        );

        if (rag.inDubioProReoApplied) {
          factualScore = Math.max(75, factualScore);
        }

        return {
          mitigatingFactors: Array.isArray(parsed.mitigatingFactors) ? parsed.mitigatingFactors : [],
          honestyScore,
          factualScore,
          defenseArgument: parsed.defenseArgument || 'Ghi nhận nỗ lực đối chất của thí sinh.',
        };
      }
    } catch (llmErr: any) {
      this.logger.debug(`[runDefender] LLM gặp sự cố (${llmErr.message}), chuyển sang heuristic.`);
    }

    // Heuristic Fallback khi LLM không kịp phản hồi
    return this.fallbackDefenderHeuristic(speechTrimmed, words, rag);
  }

  /**
   * Bộ Heuristic dự phòng cho Công tố viên
   */
  private fallbackProsecutorHeuristic(
    speechTrimmed: string,
    words: string[],
    rag: RAGMatchResult
  ): ProsecutorOpinion {
    const speechLower = speechTrimmed.toLowerCase();

    // 1. Kiểm tra câu bị cắt ngang giữa chừng khi hết giờ
    const trailingPatterns = [
      /\b(và|hoặc|thì|mà|là|ở|vào|ra|của|để|với|tới|do|vì|khi|như|ví dụ như|cụ thể là|nghĩa là|chúng ta sẽ|nhóm em sẽ)\s*$/i,
      /\b(đang|sẽ|được|có thể|trong khi|sau khi)\s*$/i,
    ];
    const isTrailingUnfinished = trailingPatterns.some((pattern) => pattern.test(speechTrimmed));

    // 2. Kiểm tra lặp từ liên tiếp do ấp úng, lắp bắp
    const stutterMatches = speechTrimmed.match(/\b([\p{L}\d]+)\s+\1\b/giu) || [];
    const hasStutter = stutterMatches.length > 0;

    const hasNumbers = rag.supportedNumbers.length > 0 || /\d+/.test(speechTrimmed);
    const wordCount = words.length;

    // PHÂN BIỆT RẠCH RÒI: VERBOSE (Nói dài, dở dang có nội dung) vs EVASION (Né tránh)
    const isVerbose = (isTrailingUnfinished && wordCount >= 18) || (wordCount >= 35 && isTrailingUnfinished);
    const isRambling = hasStutter && wordCount > 15 && !hasNumbers;

    const evasionKeywords = ['ai cũng biết', 'đương nhiên', 'chắc chắn là', 'em nghĩ là', 'sau này sẽ', 'tùy trường hợp'];
    const evasionDetected = !isVerbose && (evasionKeywords.some((kw) => speechLower.includes(kw)) || isRambling);

    let directnessScore = 55;
    if (wordCount < 15) directnessScore -= 20;
    if (isVerbose) directnessScore = 50; // Câu có nội dung nhưng chưa kịp kết luận do hết 30s
    if (isRambling) directnessScore -= 20;
    if (hasStutter) directnessScore -= 10;
    if (!hasNumbers) directnessScore -= 10;
    if (rag.hasFactualSupport) directnessScore += 15;
    if (evasionDetected) directnessScore -= 15;

    let attitudeScore = 65;
    if (isVerbose) attitudeScore = 75; // Không phạt thái độ vì thí sinh thực sự giải trình
    else if (isRambling || hasStutter) attitudeScore = 35;
    else if (evasionDetected) attitudeScore = 30;

    let critique = 'Thí sinh đối diện trực tiếp với câu hỏi.';
    if (isVerbose) {
      critique = `Thí sinh nỗ lực giải trình nhưng câu trả lời quá dài trong thời gian 30s giới hạn (chưa dứt câu kết luận).`;
    } else if (isTrailingUnfinished) {
      critique = `Câu trả lời bị ngắt giữa chừng, chưa hoàn thiện luận điểm và thiếu giải pháp cụ thể.`;
    } else if (isRambling || hasStutter) {
      critique = `Thí sinh nói vòng vo, lặp từ, nhiều từ đệm và thiếu số liệu chứng minh.`;
    } else if (evasionDetected) {
      critique = 'Thí sinh có dấu hiệu trả lời nước đôi hoặc né tránh số liệu cụ thể.';
    }

    return {
      isVague: isVerbose || isTrailingUnfinished || evasionDetected,
      evasionDetected,
      isVerbose,
      attitudeScore: Math.min(100, Math.max(10, attitudeScore)),
      directnessScore: Math.min(100, Math.max(15, directnessScore)),
      critique,
    };
  }

  /**
   * Bộ Heuristic dự phòng cho Người bào chữa
   */
  private fallbackDefenderHeuristic(
    speechTrimmed: string,
    words: string[],
    rag: RAGMatchResult
  ): DefenderOpinion {
    const trailingPatterns = [
      /\b(và|hoặc|thì|mà|là|ở|vào|ra|của|để|với|tới|do|vì|khi|như|ví dụ như|cụ thể là|nghĩa là|chúng ta sẽ|nhóm em sẽ)\s*$/i,
      /\b(đang|sẽ|được|có thể|trong khi|sau khi)\s*$/i,
    ];
    const isTrailingUnfinished = trailingPatterns.some((pattern) => pattern.test(speechTrimmed));
    const hasNumbers = rag.supportedNumbers.length > 0 || /\d+/.test(speechTrimmed);
    const wordCount = words.length;

    const mitigatingFactors: string[] = [];
    let factualScore = rag.relevanceScore;
    let honestyScore = 60;

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

    if (wordCount >= 20 && isTrailingUnfinished) {
      mitigatingFactors.push('Thí sinh nỗ lực giải trình nhiều chi tiết, câu trả lời bị ngắt khi hết 30s');
      honestyScore = 70;
    } else if (wordCount >= 25 && !isTrailingUnfinished) {
      mitigatingFactors.push('Thí sinh diễn đạt mạch lạc, nỗ lực giải trình chi tiết');
      honestyScore += 15;
    }

    let defenseArgument = 'Thí sinh có tinh thần cầu thị và nỗ lực phản biện.';
    if (mitigatingFactors.length > 0) {
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
          isVerbose: false,
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

    const prosecutor = this.fallbackProsecutorHeuristic(speechTrimmed, words, rag);
    const defender = this.fallbackDefenderHeuristic(speechTrimmed, words, rag);

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
