import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import {
  ArenaSocketEvents,
  ArenaSessionState,
  LobbyConfig,
  LobbyConfigSchema,
  CombatDifficulty,
  ArenaMode,
  JuryBossId,
  SessionFsmState,
  C2SJoinLobbyPayload,
  C2SJoinLobbyPayloadSchema,
  C2SUpdateConfigPayload,
  C2SUpdateConfigPayloadSchema,
  C2SSubmitTranscriptPayload,
  C2SSubmitTranscriptPayloadSchema,
  C2SSessionActionPayloadSchema,
  S2CTimerTickPayload,
} from '@pitcharena/shared';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ArenaGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ArenaGateway.name);

  // In-Memory Sessions Pool
  private readonly sessions = new Map<string, ArenaSessionState>();

  // In-Memory Timer Handles per Session
  private readonly sessionTimers = new Map<string, NodeJS.Timeout>();

  afterInit() {
    this.logger.log('🚀 Arena WebSocket Gateway initialized on Socket.io');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Khởi tạo hoặc tham gia vào một phiên đấu trường
   */
  @SubscribeMessage(ArenaSocketEvents.C2S_JOIN_LOBBY)
  handleJoinLobby(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawPayload: unknown
  ) {
    try {
      const payload: C2SJoinLobbyPayload =
        C2SJoinLobbyPayloadSchema.parse(rawPayload);
      const { sessionId, documentId } = payload;

      client.join(sessionId);

      let session = this.sessions.get(sessionId);
      if (!session) {
        // Cấu hình mặc định cho phiên mới
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
          transcriptHistory: [],
        };

        this.sessions.set(sessionId, session);
      }

      client.emit(ArenaSocketEvents.S2C_SESSION_SYNC, session);
      this.logger.log(`Client ${client.id} joined session ${sessionId}`);
    } catch (err: any) {
      this.logger.error(`Error in handleJoinLobby: ${err.message}`);
      client.emit(ArenaSocketEvents.S2C_ERROR, {
        code: 'INVALID_PAYLOAD',
        message: err.message,
      });
    }
  }

  /**
   * Cập nhật cấu hình phòng đấu (Độ khó, Chế độ, Solo Boss)
   */
  @SubscribeMessage(ArenaSocketEvents.C2S_UPDATE_CONFIG)
  handleUpdateConfig(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawPayload: unknown
  ) {
    try {
      const payload: C2SUpdateConfigPayload =
        C2SUpdateConfigPayloadSchema.parse(rawPayload);
      const { sessionId, config } = payload;

      const session = this.sessions.get(sessionId);
      if (!session) {
        client.emit(ArenaSocketEvents.S2C_ERROR, {
          code: 'SESSION_NOT_FOUND',
          message: 'Không tìm thấy phiên đấu tương ứng.',
        });
        return;
      }

      session.config = config;
      if (config.selectedBoss) {
        session.activeBossId = config.selectedBoss;
      }
      // Chỉ reset thời gian nếu đang ở trạng thái chuẩn bị LOBBY_READY
      if (session.fsmState === SessionFsmState.LOBBY_READY) {
        session.prepRemainingSeconds = config.prepBufferSeconds;
        session.turnRemainingSeconds = config.roundDurationSeconds;
      }

      this.server
        .to(sessionId)
        .emit(ArenaSocketEvents.S2C_SESSION_SYNC, session);
      this.logger.log(`Updated config for session ${sessionId}`);
    } catch (err: any) {
      this.logger.error(`Error in handleUpdateConfig: ${err.message}`);
      client.emit(ArenaSocketEvents.S2C_ERROR, {
        code: 'CONFIG_VALIDATION_ERROR',
        message: err.message,
      });
    }
  }

  /**
   * Bắt đầu trận đấu: Chuyển sang 7s Prep Buffer rồi sang 30s Combat
   */
  @SubscribeMessage(ArenaSocketEvents.C2S_START_COMBAT)
  handleStartCombat(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawPayload: unknown
  ) {
    try {
      const { sessionId } = C2SSessionActionPayloadSchema.parse(rawPayload);
      const session = this.sessions.get(sessionId);
      if (!session) return;

      this.clearSessionTimer(sessionId);

      session.fsmState = SessionFsmState.PREP_BUFFER;
      session.prepRemainingSeconds = session.config.prepBufferSeconds;
      session.turnRemainingSeconds = session.config.roundDurationSeconds;
      session.isPaused = false;

      this.server.to(sessionId).emit(ArenaSocketEvents.S2C_SESSION_SYNC, session);
      this.startTimerLoop(sessionId);
    } catch (err: any) {
      this.logger.error(`Error in handleStartCombat: ${err.message}`);
    }
  }

  /**
   * Bỏ qua 7s đệm suy nghĩ -> Vào luôn 30s đối chất
   */
  @SubscribeMessage(ArenaSocketEvents.C2S_SKIP_PREP)
  handleSkipPrep(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawPayload: unknown
  ) {
    try {
      const { sessionId } = C2SSessionActionPayloadSchema.parse(rawPayload);
      const session = this.sessions.get(sessionId);
      if (!session) return;

      if (session.fsmState === SessionFsmState.PREP_BUFFER) {
        session.fsmState = SessionFsmState.COMBAT_ACTIVE;
        session.prepRemainingSeconds = 0;
        session.turnRemainingSeconds = session.config.roundDurationSeconds;

        this.server
          .to(sessionId)
          .emit(ArenaSocketEvents.S2C_SESSION_SYNC, session);
        this.logger.log(`Skipped prep buffer for session ${sessionId}`);
      }
    } catch (err: any) {
      this.logger.error(`Error in handleSkipPrep: ${err.message}`);
    }
  }

  /**
   * Tạm dừng chiến thuật (Tactical Pause)
   */
  @SubscribeMessage(ArenaSocketEvents.C2S_TOGGLE_PAUSE)
  handleTogglePause(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawPayload: unknown
  ) {
    try {
      const { sessionId } = C2SSessionActionPayloadSchema.parse(rawPayload);
      const session = this.sessions.get(sessionId);
      if (!session) return;

      session.isPaused = !session.isPaused;
      this.server.to(sessionId).emit(ArenaSocketEvents.S2C_SESSION_SYNC, session);

      // Phát tick tức thời để Client đồng bộ ngay lập tức trạng thái isPaused
      this.server.to(sessionId).emit(ArenaSocketEvents.S2C_TIMER_TICK, {
        fsmState: session.fsmState,
        prepRemainingSeconds: session.prepRemainingSeconds,
        turnRemainingSeconds: session.turnRemainingSeconds,
        isPaused: session.isPaused,
      });
    } catch (err: any) {
      this.logger.error(`Error in handleTogglePause: ${err.message}`);
    }
  }

  /**
   * Tiếp nhận bản phiên âm giọng nói (Live Transcript Stream)
   */
  @SubscribeMessage(ArenaSocketEvents.C2S_SUBMIT_TRANSCRIPT)
  handleSubmitTranscript(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawPayload: unknown
  ) {
    try {
      const payload: C2SSubmitTranscriptPayload =
        C2SSubmitTranscriptPayloadSchema.parse(rawPayload);
      const { sessionId, text, isFinal } = payload;
      const session = this.sessions.get(sessionId);
      if (!session) return;

      const livePayload = {
        sender: 'CANDIDATE' as const,
        text,
        isFinal,
        timestamp: new Date().toLocaleTimeString(),
      };

      // Broadcast live transcript
      this.server
        .to(sessionId)
        .emit(ArenaSocketEvents.S2C_LIVE_TRANSCRIPT, livePayload);

      if (isFinal && text.trim()) {
        session.transcriptHistory.push({
          sender: 'CANDIDATE',
          text,
          timestamp: new Date().toLocaleTimeString(),
        });
      }
    } catch (err: any) {
      this.logger.error(`Error in handleSubmitTranscript: ${err.message}`);
    }
  }

  /**
   * Vòng lặp đếm thời gian 1s độc lập trên Server (Server-Authoritative Clock)
   */
  private startTimerLoop(sessionId: string) {
    const timer = setInterval(() => {
      const session = this.sessions.get(sessionId);
      if (!session) {
        this.clearSessionTimer(sessionId);
        return;
      }

      if (session.isPaused) return;

      // 1. Giai đoạn PREP_BUFFER (7s đệm)
      if (session.fsmState === SessionFsmState.PREP_BUFFER) {
        if (session.prepRemainingSeconds > 0) {
          session.prepRemainingSeconds -= 1;
        } else {
          // Hết đệm -> Chuyển sang lượt đối chất
          session.fsmState = SessionFsmState.COMBAT_ACTIVE;
          session.turnRemainingSeconds = session.config.roundDurationSeconds;
        }
      }
      // 2. Giai đoạn COMBAT_ACTIVE (30s đối chất)
      else if (session.fsmState === SessionFsmState.COMBAT_ACTIVE) {
        if (session.turnRemainingSeconds > 0) {
          session.turnRemainingSeconds -= 1;
        } else {
          // Hết 30s -> Tạm dừng lượt
          session.fsmState = SessionFsmState.BOSS_QUESTIONING;
          this.clearSessionTimer(sessionId);
        }
      }

      // Phát tín hiệu Tick về Client
      const tickPayload: S2CTimerTickPayload = {
        fsmState: session.fsmState,
        prepRemainingSeconds: session.prepRemainingSeconds,
        turnRemainingSeconds: session.turnRemainingSeconds,
        isPaused: session.isPaused,
      };

      this.server.to(sessionId).emit(ArenaSocketEvents.S2C_TIMER_TICK, tickPayload);
    }, 1000);

    this.sessionTimers.set(sessionId, timer);
  }

  private clearSessionTimer(sessionId: string) {
    const timer = this.sessionTimers.get(sessionId);
    if (timer) {
      clearInterval(timer);
      this.sessionTimers.delete(sessionId);
    }
  }
}
