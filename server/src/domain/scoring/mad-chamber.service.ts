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
    // Có thể dùng LLM hoặc Heuristic nhanh
    const speechLower = speech.toLowerCase();

    // Dấu hiệu cãi cùn / né tránh: "tất nhiên là", "ai cũng biết", "chắc chắn sẽ", "nhóm em nghĩ là"
    const evasionKeywords = ['ai cũng biết', 'đương nhiên', 'chắc chắn là', 'em nghĩ là', 'sau này sẽ', 'tùy trường hợp'];
    const evasionDetected = evasionKeywords.some((kw) => speechLower.includes(kw));

    // Dấu hiệu cầu thị: "nhóm em xin tiếp thu", "đây là thiếu sót", "nhóm đã thử nghiệm", "số liệu thực tế là"
    const honestKeywords = ['tiếp thu', 'thiếu sót', 'thực tế khảo sát', 'số liệu hiện tại', 'đang hoàn thiện'];
    const hasHonesty = honestKeywords.some((kw) => speechLower.includes(kw));

    const isShort = speech.trim().split(/\s+/).length < 15;
    const isVague = isShort || (!rag.hasFactualSupport && evasionDetected);

    let directnessScore = isShort ? 40 : 70;
    if (rag.hasFactualSupport) directnessScore += 20;
    if (evasionDetected) directnessScore -= 25;

    let attitudeScore = 60;
    if (hasHonesty) attitudeScore = 90;
    else if (evasionDetected) attitudeScore = 40;

    return {
      isVague,
      evasionDetected,
      attitudeScore: Math.min(100, Math.max(20, attitudeScore)),
      directnessScore: Math.min(100, Math.max(20, directnessScore)),
      critique: evasionDetected
        ? 'Thí sinh có dấu hiệu trả lời nước đôi hoặc né tránh số liệu cụ thể.'
        : isVague
        ? 'Câu trả lời còn quá ngắn hoặc chung chung, chưa chạm đến trọng tâm.'
        : 'Thí sinh đối diện trực tiếp với câu hỏi.',
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
    const mitigatingFactors: string[] = [];
    let factualScore = rag.relevanceScore;
    let honestyScore = 65;

    if (rag.inDubioProReoApplied) {
      mitigatingFactors.push('Áp dụng suy đoán vô tội: Số liệu được xác thực từ đề mục chéo trong tài liệu');
      factualScore = Math.max(75, factualScore);
    }

    if (rag.supportedNumbers.length > 0) {
      mitigatingFactors.push(`Thí sinh đưa ra số liệu rõ ràng có kiểm chứng (${rag.supportedNumbers.join(', ')})`);
      factualScore += 15;
    }

    const speechLength = speech.trim().split(/\s+/).length;
    if (speechLength >= 25) {
      mitigatingFactors.push('Thí sinh diễn đạt mạch lạc, nỗ lực giải trình chi tiết');
      honestyScore += 15;
    }

    return {
      mitigatingFactors,
      honestyScore: Math.min(100, Math.max(30, honestyScore)),
      factualScore: Math.min(100, Math.max(30, factualScore)),
      defenseArgument:
        mitigatingFactors.length > 0
          ? mitigatingFactors.join('; ')
          : 'Thí sinh có tinh thần cầu thị và nỗ lực phản biện.',
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
    const wordCount = speech.trim().split(/\s+/).length;
    const hasNumbers = rag.supportedNumbers.length > 0;

    const prosecutor: ProsecutorOpinion = {
      isVague: wordCount < 15 && !hasNumbers,
      evasionDetected: false,
      attitudeScore: 65,
      directnessScore: wordCount >= 20 ? 70 : 50,
      critique: '[Fallback Heuristic] Đánh giá theo mật độ thông tin và căn cứ tài liệu.',
    };

    const defender: DefenderOpinion = {
      mitigatingFactors: rag.inDubioProReoApplied
        ? ['[In Dubio Pro Reo] Được bảo lưu điểm nhờ số liệu chéo trong tài liệu']
        : ['Thí sinh phản biện với thái độ nghiêm túc'],
      honestyScore: 65,
      factualScore: rag.relevanceScore,
      defenseArgument: '[Fallback Heuristic] Ghi nhận nỗ lực đối chất của thí sinh.',
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
