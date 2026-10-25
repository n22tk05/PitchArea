import { Injectable, Logger } from '@nestjs/common';
import {
  ArenaSessionState,
  LobbyConfig,
  SessionFsmState,
  JuryBossId,
  CombatDifficulty,
  ArenaMode,
  BOSS_TO_SECTION_MAP,
  BusinessSectionLabel,
  BusinessSectionType,
  JURY_BOSS_PROFILES,
} from '@pitcharena/shared';
import { SessionTimerController, TimerTickCallbackData } from './timer-controller';

@Injectable()
export class ArenaFsmService {
  private readonly logger = new Logger(ArenaFsmService.name);

  // In-Memory Sessions Registry (RAM-backed)
  private readonly sessions = new Map<string, ArenaSessionState>();
  private readonly timers = new Map<string, SessionTimerController>();

  /**
   * Khởi tạo hoặc lấy phiên hiện tại từ RAM
   */
  public getOrCreateSession(
    sessionId: string,
    documentId: string,
    availableBossIds?: JuryBossId[]
  ): ArenaSessionState {
    let session = this.sessions.get(sessionId);

    const validBosses =
      availableBossIds && availableBossIds.length > 0
        ? availableBossIds
        : Object.values(JuryBossId);

    // Chọn ngẫu nhiên Giám khảo mở màn từ danh sách Giám khảo khả dụng để các phiên không bị trùng lặp
    const randomBossIndex = Math.floor(Math.random() * validBosses.length);
    const initialBoss = validBosses[randomBossIndex];

    if (!session) {
      const defaultConfig: LobbyConfig = {
        mode: ArenaMode.FULL_ARENA,
        difficulty: CombatDifficulty.NORMAL,
        selectedBoss: initialBoss,
        roundDurationSeconds: 30,
        prepBufferSeconds: 3,
        enableLiveSubtitles: true,
        pedagogicalShieldFloor: 20,
      };

      session = {
        sessionId,
        documentId,
        config: defaultConfig,
        fsmState: SessionFsmState.LOBBY_READY,
        currentTurn: 1,
        totalTurns: Math.max(
          10,
          Math.ceil(((defaultConfig.qaDurationMinutes || 3) * 60) / (defaultConfig.roundDurationSeconds || 30))
        ),
        activeBossId: initialBoss,
        availableBossIds: validBosses,
        candidateHp: 100,
        prepRemainingSeconds: defaultConfig.prepBufferSeconds,
        turnRemainingSeconds: defaultConfig.roundDurationSeconds,
        isPaused: false,
        isTimeFrozen: false,
        isStreamingQuestion: false,
        activeQuestion: undefined,
        followUpCount: 0,
        currentTopic: undefined,
        isCoachingPivot: false,
        transcriptHistory: [],
      };

      this.sessions.set(sessionId, session);

      // Khởi tạo Timer tương ứng
      const timer = new SessionTimerController(
        sessionId,
        session.fsmState,
        defaultConfig.prepBufferSeconds,
        defaultConfig.roundDurationSeconds
      );
      this.timers.set(sessionId, timer);
      this.logger.log(`Initialized in-memory session: ${sessionId} with available bosses: [${validBosses.join(', ')}]`);
    } else if (availableBossIds && availableBossIds.length > 0) {
      session.availableBossIds = availableBossIds;
      if (!availableBossIds.includes(session.activeBossId)) {
        session.activeBossId = availableBossIds[0];
      }
    }

    return session;
  }

  public getSession(sessionId: string): ArenaSessionState | undefined {
    return this.sessions.get(sessionId);
  }

  public getTimer(sessionId: string): SessionTimerController | undefined {
    return this.timers.get(sessionId);
  }

  /**
   * Cập nhật cấu hình phòng đấu
   */
  public updateConfig(
    sessionId: string,
    config: LobbyConfig
  ): ArenaSessionState | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    session.config = config;
    if (config.qaDurationMinutes) {
      session.totalTurns = Math.max(
        10,
        Math.ceil((config.qaDurationMinutes * 60) / (config.roundDurationSeconds || 30))
      );
    }
    if (config.selectedBoss) {
      if (
        !session.availableBossIds ||
        session.availableBossIds.includes(config.selectedBoss)
      ) {
        session.activeBossId = config.selectedBoss;
      } else if (session.availableBossIds && session.availableBossIds.length > 0) {
        session.activeBossId = session.availableBossIds[0];
      }
    }

    const timer = this.timers.get(sessionId);
    if (timer && session.fsmState === SessionFsmState.LOBBY_READY) {
      timer.setDurations(config.prepBufferSeconds, config.roundDurationSeconds);
      session.prepRemainingSeconds = config.prepBufferSeconds;
      session.turnRemainingSeconds = config.roundDurationSeconds;
    }

    return session;
  }

  /**
   * Trừ máu thí sinh có kẹp sàn bảo vệ tân thủ (Pedagogical Shield Floor 20%) trong 3 lượt đầu.
   * Từ lượt thứ 4 trở đi, khiên bảo vệ hết hiệu lực (bị phá vỡ), sàn bảo vệ về 0% (cho phép trừ xuyên sàn).
   */
  public deductHp(sessionId: string, penaltyAmount: number): number {
    const session = this.sessions.get(sessionId);
    if (!session) return 100;

    const isShieldActive = (session.currentTurn ?? 1) <= 3;
    const floor = isShieldActive ? (session.config.pedagogicalShieldFloor ?? 20) : 0;
    const newHp = Math.max(floor, session.candidateHp - penaltyAmount);
    session.candidateHp = newHp;
    this.logger.log(
      `[${sessionId}] Deducted ${penaltyAmount} HP -> Current HP: ${newHp}% (Lượt ${session.currentTurn} | Khiên tân thủ: ${
        isShieldActive ? `BẢO VỆ (${floor}%)` : 'ĐÃ VỠ / MẤT BẢO HỘ (Sàn 0%)'
      })`
    );
    return newHp;
  }

  /**
   * Chuyển trạng thái FSM an toàn
   */
  public transitionState(
    sessionId: string,
    targetState: SessionFsmState
  ): ArenaSessionState | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const oldState = session.fsmState;
    session.fsmState = targetState;

    const timer = this.timers.get(sessionId);
    if (timer) {
      timer.setFsmState(targetState);
    }

    this.logger.log(`[${sessionId}] FSM Transition: ${oldState} -> ${targetState}`);

    // Ghi log chi tiết căn cứ đề mục khi Giám khảo bước vào lượt chất vấn
    if (targetState === SessionFsmState.BOSS_QUESTIONING) {
      this.logJudgeQuestionBasis(session);
    }

    return session;
  }

  /**
   * Ghi log chi tiết căn cứ câu hỏi của Giám khảo:
   * - Giám khảo nào đang chất vấn (Tên, danh xưng, chuyên môn)
   * - Dựa trên phần / nhóm đề mục nào của tài liệu (Section Type & Section Vietnamese Label)
   * - Chủ đề truy vấn (Topic) và câu hỏi chi tiết (nếu có)
   */
  public logJudgeQuestionBasis(
    sessionOrSessionId: ArenaSessionState | string,
    context?: {
      topic?: string;
      activeQuestion?: string;
      sectionNames?: string[];
    }
  ): void {
    const session =
      typeof sessionOrSessionId === 'string'
        ? this.sessions.get(sessionOrSessionId)
        : sessionOrSessionId;
    if (!session) return;

    const bossId = session.activeBossId;
    const profile = JURY_BOSS_PROFILES[bossId];
    const bossName = profile?.name || bossId;
    const bossTitle = profile?.title || 'Giám khảo Thẩm định';
    const bossDomain = profile?.domain || 'Chuyên môn Thẩm định';

    const sectionTypes: BusinessSectionType[] = BOSS_TO_SECTION_MAP[bossId] || [];
    const sectionDescriptions = sectionTypes.map((type) => {
      const label = BusinessSectionLabel[type] || type;
      return `[${type}] ${label}`;
    });

    const topic = context?.topic || session.currentTopic || 'Chủ đề theo chuyên môn Giám khảo';
    const question = context?.activeQuestion || session.activeQuestion;
    const sectionBasis =
      context?.sectionNames && context.sectionNames.length > 0
        ? context.sectionNames.join(' | ')
        : sectionDescriptions.join(' | ');

    this.logger.log(
      `\n================================================================================` +
      `\n[ARENA FSM] 🎯 GIÁM KHẢO CHẤT VẤN - CĂN CỨ ĐỀ MỤC TÀI LIỆU` +
      `\n- Lượt đấu: ${session.currentTurn}/${session.totalTurns} | Session: ${session.sessionId}` +
      `\n- Giám khảo: ${bossName} (${bossTitle})` +
      `\n- Lĩnh vực chuyên môn: ${bossDomain}` +
      `\n- DỰA TRÊN PHẦN/ĐỀ MỤC: ${sectionBasis || 'Toàn bộ nội dung đề án'}` +
      `\n- Chủ đề truy vấn: ${topic}` +
      (question ? `\n- Nội dung câu hỏi: "${question}"` : '') +
      `\n================================================================================`
    );
  }

  /**
   * Cập nhật câu hỏi đang hoạt động và ghi log chi tiết câu hỏi cùng căn cứ đề mục
   */
  public setActiveQuestion(
    sessionId: string,
    question: string,
    topic?: string,
    detectedSectionTitles?: string[]
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.activeQuestion = question;
    if (topic) session.currentTopic = topic;

    this.logJudgeQuestionBasis(session, {
      topic: session.currentTopic,
      activeQuestion: question,
      sectionNames: detectedSectionTitles,
    });
  }

  /**
   * Cập nhật thời gian từ Timer Tick
   */
  public applyTimerTick(sessionId: string, tick: TimerTickCallbackData) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.prepRemainingSeconds = tick.prepRemainingSeconds;
    session.turnRemainingSeconds = tick.turnRemainingSeconds;
    session.isPaused = tick.isPaused;
    session.isTimeFrozen = tick.isTimeFrozen;
    session.fsmState = tick.fsmState;
  }

  /**
   * Xóa phiên khi đóng kết nối hoặc kết thúc hoàn toàn
   */
  public destroySession(sessionId: string) {
    const timer = this.timers.get(sessionId);
    if (timer) {
      timer.stop();
      this.timers.delete(sessionId);
    }
    this.sessions.delete(sessionId);
    this.logger.log(`Cleaned up session ${sessionId}`);
  }
}
