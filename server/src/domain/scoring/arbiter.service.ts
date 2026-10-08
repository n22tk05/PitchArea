import { Injectable, Logger } from '@nestjs/common';
import {
  ArenaSessionState,
  VerdictResult,
  VerdictScore,
  JuryBossId,
} from '@pitcharena/shared';
import { RAGEngineService } from './rag-engine.service';
import { MADChamberService } from './mad-chamber.service';
import { calculatePenalty } from './penalty-matrix';
import { StreakEngine } from './streak-engine';
import { DocumentService } from '../../document/document.service';

@Injectable()
export class ArbiterService {
  private readonly logger = new Logger(ArbiterService.name);
  private readonly streakEngines = new Map<string, StreakEngine>();

  constructor(
    private readonly ragEngine: RAGEngineService,
    private readonly madChamber: MADChamberService,
    private readonly documentService: DocumentService
  ) {}

  /**
   * Lấy hoặc tạo mới StreakEngine cho từng session
   */
  private getStreakEngine(sessionId: string, initialStreak?: { count: number; type: 'WIN' | 'LOSE' | 'NEUTRAL' }): StreakEngine {
    if (!this.streakEngines.has(sessionId)) {
      this.streakEngines.set(sessionId, new StreakEngine(initialStreak));
    }
    return this.streakEngines.get(sessionId)!;
  }

  /**
   * Phán xử toàn diện phát ngôn phản biện của thí sinh
   */
  public async evaluateDefense(
    session: ArenaSessionState,
    candidateSpeech: string
  ): Promise<VerdictResult> {
    const startTime = Date.now();
    const bossId = session.activeBossId || JuryBossId.FINANCE_DRAGON;
    const topic = session.currentTopic || 'Mô hình kinh doanh & Chi phí';
    const activeQuestion = session.activeQuestion || 'Vui lòng làm rõ số liệu dự án.';

    // 1. Tra cứu tài liệu Word từ DocumentService
    const doc = this.documentService.getDocument(session.documentId);
    const sections = doc?.sections || [];

    // 2. Chạy 4-Layer Bulletproof RAG (kèm In Dubio Pro Reo)
    const ragResult = this.ragEngine.verifyDefense(candidateSpeech, bossId, sections);

    // 3. Đưa vào phòng phán xử kín MAD Chamber (Prosecutor & Defender chạy song song, Circuit Breaker 600ms)
    const chamberResult = await this.madChamber.deliberate(
      activeQuestion,
      candidateSpeech,
      ragResult,
      session.config.evaluationPreset
    );

    // 4. Tính toán điểm cốt lõi D, F, H và Q
    const directness = chamberResult.prosecutor.directnessScore;
    const factualBacking = chamberResult.defender.factualScore;
    const intellectualHonesty = chamberResult.defender.honestyScore;

    // Q = 0.40D + 0.40F + 0.20H (chuẩn hóa tỷ lệ)
    const overallScore = Math.round(
      0.40 * directness + 0.40 * factualBacking + 0.20 * intellectualHonesty
    );

    const score: VerdictScore = {
      directness,
      factualBacking,
      intellectualHonesty,
      overallScore,
    };

    // 5. Xác định hệ số thái độ (Attitude Multiplier)
    let attitudeMultiplier = 1.0;
    if (chamberResult.prosecutor.evasionDetected) {
      attitudeMultiplier = 1.4; // Phạt tăng thêm 40% nếu cãi cùn hoặc né tránh
    } else if (intellectualHonesty >= 80) {
      attitudeMultiplier = 0.5; // Giảm 50% phạt nếu thừa nhận thiếu sót một cách trung thực
    }

    // 6. Cập nhật Streak Engine
    const streakEngine = this.getStreakEngine(session.sessionId, session.streak);
    const streakResult = streakEngine.update(overallScore);
    session.streak = streakResult.streak;

    // 7. Tính biến động máu qua Ma trận Phạt (Penalty Matrix) kẹp Sàn tân thủ 20%
    const penaltyResult = calculatePenalty({
      overallScore,
      difficulty: session.config.difficulty,
      attitudeMultiplier,
      streakMultiplier: streakResult.streakMultiplier,
      currentHp: session.candidateHp,
      turnNumber: session.currentTurn,
      shieldFloor: session.config.pedagogicalShieldFloor ?? 20,
    });

    let finalHpDelta = penaltyResult.hpDelta;
    let finalExplanation = penaltyResult.explanation;

    // Thưởng thêm máu nếu kích hoạt Comeback Surge
    if (streakResult.isComebackSurge) {
      finalHpDelta += streakResult.bonusHp;
      finalExplanation += ` [COMEBACK SURGE: Thưởng phục hồi thêm +${streakResult.bonusHp} HP!]`;
    }

    const totalTimeMs = Date.now() - startTime;
    this.logger.log(`\n👑 [HỘI ĐỒNG TRỌNG TÀI - PHÁN QUYẾT CHÍNH THỨC] (Lượt ${session.currentTurn}) [${totalTimeMs}ms]`);
    this.logger.log(`💬 LÝ DO PHÁN QUYẾT: "${finalExplanation}"`);
    this.logger.log(
      `🎯 ĐIỂM TỔNG HỢP Q: ${overallScore}/100 | Trọng tâm D: ${directness} | Căn cứ F: ${factualBacking} | Trung thực H: ${intellectualHonesty}`
    );
    this.logger.log(
      `🩸 BIẾN ĐỘNG HP: ${finalHpDelta > 0 ? '+' : ''}${finalHpDelta} HP | Sàn tân thủ: ${penaltyResult.isShieldProtected ? 'KÍCH HOẠT BẢO VỆ (20%)' : 'Bình thường'}\n`
    );

    return {
      turnIndex: session.currentTurn,
      bossId,
      topic,
      score,
      hpDelta: finalHpDelta,
      isHeal: finalHpDelta > 0,
      reason: finalExplanation,
      attitudeMultiplier,
      streakCount: streakResult.streak.count,
      isShieldProtected: penaltyResult.isShieldProtected,
      isRedemptionQuestion: penaltyResult.isRedemptionQuestion,
      prosecutorArgument: chamberResult.prosecutor.critique,
      defenderArgument: chamberResult.defender.defenseArgument,
    };
  }
}
