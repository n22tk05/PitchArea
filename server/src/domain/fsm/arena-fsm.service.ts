import { Injectable, Logger } from '@nestjs/common';
import {
  ArenaSessionState,
  LobbyConfig,
  SessionFsmState,
  JuryBossId,
  CombatDifficulty,
  ArenaMode,
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
    documentId: string
  ): ArenaSessionState {
    let session = this.sessions.get(sessionId);
    if (!session) {
      const defaultConfig: LobbyConfig = {
        mode: ArenaMode.FULL_ARENA,
        difficulty: CombatDifficulty.NORMAL,
        selectedBoss: JuryBossId.FINANCE_DRAGON,
        roundDurationSeconds: 30,
        prepBufferSeconds: 7,
        enableLiveSubtitles: true,
        pedagogicalShieldFloor: 20,
      };

      session = {
        sessionId,
        documentId,
        config: defaultConfig,
        fsmState: SessionFsmState.LOBBY_READY,
        currentTurn: 1,
        totalTurns: 3,
        activeBossId: JuryBossId.FINANCE_DRAGON,
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
      this.logger.log(`Initialized in-memory session: ${sessionId}`);
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
    if (config.selectedBoss) {
      session.activeBossId = config.selectedBoss;
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
   * Trừ máu thí sinh có kẹp sàn bảo vệ tân thủ (Pedagogical Shield Floor 20%)
   */
  public deductHp(sessionId: string, penaltyAmount: number): number {
    const session = this.sessions.get(sessionId);
    if (!session) return 100;

    const floor = session.config.pedagogicalShieldFloor ?? 20;
    const newHp = Math.max(floor, session.candidateHp - penaltyAmount);
    session.candidateHp = newHp;
    this.logger.log(
      `[${sessionId}] Deducted ${penaltyAmount} HP -> Current HP: ${newHp}% (Floor: ${floor}%)`
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
    return session;
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
