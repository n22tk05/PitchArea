import { Logger } from '@nestjs/common';
import { SessionFsmState } from '@pitcharena/shared';

export interface TimerTickCallbackData {
  fsmState: SessionFsmState;
  prepRemainingSeconds: number;
  turnRemainingSeconds: number;
  isPaused: boolean;
  isTimeFrozen: boolean;
  overtimeGraceSeconds: number;
}

export type TimerTickCallback = (data: TimerTickCallbackData) => void;

export class SessionTimerController {
  private readonly logger = new Logger(SessionTimerController.name);

  private timerInterval: NodeJS.Timeout | null = null;
  private isPaused = false;
  private isTimeFrozen = false;
  private freezeReason: string | null = null;

  private prepSeconds = 7;
  private turnSeconds = 30;
  private overtimeGraceSeconds = 0;
  private readonly MAX_OVERTIME_GRACE = 15;

  private onTickCallback: TimerTickCallback | null = null;
  private onTurnExpireCallback: (() => void) | null = null;
  private onPrepExpireCallback: (() => void) | null = null;

  constructor(
    private readonly sessionId: string,
    private fsmState: SessionFsmState = SessionFsmState.LOBBY_READY,
    defaultPrepSeconds = 7,
    defaultTurnSeconds = 30
  ) {
    this.prepSeconds = defaultPrepSeconds;
    this.turnSeconds = defaultTurnSeconds;
  }

  public setCallbacks(callbacks: {
    onTick?: TimerTickCallback;
    onPrepExpire?: () => void;
    onTurnExpire?: () => void;
  }) {
    if (callbacks.onTick) this.onTickCallback = callbacks.onTick;
    if (callbacks.onPrepExpire) this.onPrepExpireCallback = callbacks.onPrepExpire;
    if (callbacks.onTurnExpire) this.onTurnExpireCallback = callbacks.onTurnExpire;
  }

  public setFsmState(state: SessionFsmState) {
    this.fsmState = state;
  }

  public setDurations(prep: number, turn: number) {
    this.prepSeconds = prep;
    this.turnSeconds = turn;
    this.overtimeGraceSeconds = 0;
  }

  /**
   * Đóng băng thời gian (Time Freeze)
   * Sử dụng khi AI stream câu hỏi hoặc thí sinh nộp bài phản biện
   */
  public freeze(reason = 'AI_STREAMING') {
    this.isTimeFrozen = true;
    this.freezeReason = reason;
    this.logger.debug(`[${this.sessionId}] Time FROZEN: ${reason}`);
    this.emitCurrentTick();
  }

  /**
   * Mở lại đồng hồ sau khi AI stream xong câu hỏi
   */
  public unfreeze() {
    this.isTimeFrozen = false;
    this.freezeReason = null;
    this.logger.debug(`[${this.sessionId}] Time UNFROZEN`);
    this.emitCurrentTick();
  }

  public togglePause(): boolean {
    this.isPaused = !this.isPaused;
    this.emitCurrentTick();
    return this.isPaused;
  }

  public start() {
    this.stop();
    this.timerInterval = setInterval(() => {
      this.handleTick();
    }, 1000);
  }

  public stop() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  /**
   * Kích hoạt 15s Overtime Grace nếu thí sinh đang nói dở câu kết bài
   */
  public grantOvertimeGrace(): boolean {
    if (this.overtimeGraceSeconds < this.MAX_OVERTIME_GRACE) {
      this.overtimeGraceSeconds = this.MAX_OVERTIME_GRACE;
      this.logger.log(`[${this.sessionId}] Granted 15s Overtime Grace!`);
      this.emitCurrentTick();
      return true;
    }
    return false;
  }

  private handleTick() {
    if (this.isPaused || this.isTimeFrozen) {
      // Khi đang pause hoặc freeze, không trừ giây nhưng vẫn giữ nhịp
      return;
    }

    if (this.fsmState === SessionFsmState.PREP_BUFFER) {
      if (this.prepSeconds > 0) {
        this.prepSeconds -= 1;
      } else {
        if (this.onPrepExpireCallback) {
          this.onPrepExpireCallback();
        }
      }
    } else if (
      this.fsmState === SessionFsmState.COMBAT_ACTIVE ||
      this.fsmState === SessionFsmState.CANDIDATE_PITCH
    ) {
      if (this.turnSeconds > 0) {
        this.turnSeconds -= 1;
      } else if (this.overtimeGraceSeconds > 0) {
        // Sử dụng quỹ Overtime Grace
        this.overtimeGraceSeconds -= 1;
      } else {
        // Hết thời gian thi đấu lượt này
        if (this.onTurnExpireCallback) {
          this.onTurnExpireCallback();
        }
      }
    }

    this.emitCurrentTick();
  }

  private emitCurrentTick() {
    if (this.onTickCallback) {
      this.onTickCallback({
        fsmState: this.fsmState,
        prepRemainingSeconds: this.prepSeconds,
        turnRemainingSeconds: this.turnSeconds,
        isPaused: this.isPaused,
        isTimeFrozen: this.isTimeFrozen,
        overtimeGraceSeconds: this.overtimeGraceSeconds,
      });
    }
  }

  public getSnapshot() {
    return {
      fsmState: this.fsmState,
      prepSeconds: this.prepSeconds,
      turnSeconds: this.turnSeconds,
      isPaused: this.isPaused,
      isTimeFrozen: this.isTimeFrozen,
      freezeReason: this.freezeReason,
      overtimeGraceSeconds: this.overtimeGraceSeconds,
    };
  }
}
