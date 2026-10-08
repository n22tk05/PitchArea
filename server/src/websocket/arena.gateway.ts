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
  SessionFsmState,
  C2SJoinLobbyPayload,
  C2SJoinLobbyPayloadSchema,
  C2SUpdateConfigPayload,
  C2SUpdateConfigPayloadSchema,
  C2SSubmitTranscriptPayload,
  C2SSubmitTranscriptPayloadSchema,
  C2SSessionActionPayloadSchema,
  C2SRequestNextQuestionPayloadSchema,
  C2SSubmitDefensePayloadSchema,
  S2CTimerTickPayload,
  S2CBossStreamChunkPayload,
  S2CTimeFreezePayload,
  S2CCoachingAlertPayload,
  S2CVerdictAnnouncedPayload,
  getAvailableBossesForSections,
  JURY_BOSS_PROFILES,
} from '@pitcharena/shared';
import { ArenaFsmService } from '../domain/fsm/arena-fsm.service';
import { GeminiService } from '../adapters/llm/gemini.service';
import { FollowUpEngine } from '../domain/orchestrator/follow-up-engine';
import { DocumentService } from '../document/document.service';
import { ArbiterService } from '../domain/scoring/arbiter.service';

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

  constructor(
    private readonly fsmService: ArenaFsmService,
    private readonly geminiService: GeminiService,
    private readonly followUpEngine: FollowUpEngine,
    private readonly documentService: DocumentService,
    private readonly arbiterService: ArbiterService
  ) {}

  /**
   * Loại bỏ transcriptHistory (Bảng nhật ký) trước khi gửi session về client để giảm tải mạng và giữ sạch state
   */
  private sanitizeSessionForClient(session: any) {
    if (!session) return session;
    const { transcriptHistory, ...clientSession } = session;
    return clientSession;
  }

  afterInit() {
    this.logger.log('Arena WebSocket Gateway initialized with Multi-Agent FSM Engine');
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

      const doc = this.documentService.getDocument(documentId);
      const availableBossIds = doc ? getAvailableBossesForSections(doc.sections) : undefined;
      const session = this.fsmService.getOrCreateSession(sessionId, documentId, availableBossIds);

      // Cấu hình timer callbacks nếu chưa có
      const timer = this.fsmService.getTimer(sessionId);
      if (timer) {
        timer.setCallbacks({
          onTick: (data) => {
            this.fsmService.applyTimerTick(sessionId, data);
            const tickPayload: S2CTimerTickPayload = {
              fsmState: data.fsmState,
              prepRemainingSeconds: data.prepRemainingSeconds,
              turnRemainingSeconds: data.turnRemainingSeconds,
              isPaused: data.isPaused,
              isTimeFrozen: data.isTimeFrozen,
            };
            this.server.to(sessionId).emit(ArenaSocketEvents.S2C_TIMER_TICK, tickPayload);
          },
          onPrepExpire: () => {
            this.triggerBossQuestioning(sessionId);
          },
          onTurnExpire: () => {
            this.handleTurnTimeOut(sessionId);
          },
        });
      }

      client.emit(ArenaSocketEvents.S2C_SESSION_SYNC, this.sanitizeSessionForClient(session));
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
   * Cập nhật cấu hình phòng đấu
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

      const session = this.fsmService.updateConfig(sessionId, config);
      if (!session) {
        client.emit(ArenaSocketEvents.S2C_ERROR, {
          code: 'SESSION_NOT_FOUND',
          message: 'Không tìm thấy phiên đấu tương ứng.',
        });
        return;
      }

      this.server
        .to(sessionId)
        .emit(ArenaSocketEvents.S2C_SESSION_SYNC, this.sanitizeSessionForClient(session));
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
   * Bắt đầu trận đấu: Chuyển sang 7s Prep Buffer rồi sang Boss chất vấn
   */
  @SubscribeMessage(ArenaSocketEvents.C2S_START_COMBAT)
  handleStartCombat(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawPayload: unknown
  ) {
    try {
      const { sessionId } = C2SSessionActionPayloadSchema.parse(rawPayload);
      const session = this.fsmService.getSession(sessionId);
      if (!session) return;

      const timer = this.fsmService.getTimer(sessionId);
      if (timer) {
        timer.setDurations(session.config.prepBufferSeconds, session.config.roundDurationSeconds);
        this.fsmService.transitionState(sessionId, SessionFsmState.PREP_BUFFER);
        session.prepRemainingSeconds = session.config.prepBufferSeconds;
        session.turnRemainingSeconds = session.config.roundDurationSeconds;
        session.isPaused = false;
        session.isTimeFrozen = false;

        this.server.to(sessionId).emit(ArenaSocketEvents.S2C_SESSION_SYNC, this.sanitizeSessionForClient(session));
        timer.start();
      }
    } catch (err: any) {
      this.logger.error(`Error in handleStartCombat: ${err.message}`);
    }
  }

  /**
   * Bỏ qua 7s đệm suy nghĩ -> Kích hoạt ngay Giám khảo đặt câu hỏi
   */
  @SubscribeMessage(ArenaSocketEvents.C2S_SKIP_PREP)
  handleSkipPrep(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawPayload: unknown
  ) {
    try {
      const { sessionId } = C2SSessionActionPayloadSchema.parse(rawPayload);
      const session = this.fsmService.getSession(sessionId);
      if (!session) return;

      if (session.fsmState === SessionFsmState.PREP_BUFFER) {
        this.logger.log(`[${sessionId}] Skipped prep buffer -> Triggering Boss questioning`);
        this.triggerBossQuestioning(sessionId);
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
      const timer = this.fsmService.getTimer(sessionId);
      const session = this.fsmService.getSession(sessionId);
      if (!timer || !session) return;

      const isPaused = timer.togglePause();
      session.isPaused = isPaused;

      this.server.to(sessionId).emit(ArenaSocketEvents.S2C_SESSION_SYNC, this.sanitizeSessionForClient(session));
    } catch (err: any) {
      this.logger.error(`Error in handleTogglePause: ${err.message}`);
    }
  }

  /**
   * Thí sinh nộp bài phản biện (Defense Submission)
   */
  @SubscribeMessage(ArenaSocketEvents.C2S_SUBMIT_DEFENSE)
  async handleSubmitDefense(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawPayload: unknown
  ) {
    try {
      const { sessionId, defenseText } =
        C2SSubmitDefensePayloadSchema.parse(rawPayload);

      const session = this.fsmService.getSession(sessionId);
      const timer = this.fsmService.getTimer(sessionId);
      if (!session || !timer) return;

      // 1. Time Freeze khi tiếp nhận bài nộp
      timer.freeze('CANDIDATE_SUBMIT_DEFENSE');
      this.fsmService.transitionState(sessionId, SessionFsmState.TIME_FREEZE);

      const freezePayload: S2CTimeFreezePayload = {
        isFrozen: true,
        reason: 'CANDIDATE_SUBMIT',
      };
      this.server.to(sessionId).emit(ArenaSocketEvents.S2C_TIME_FREEZE, freezePayload);

      // Lưu vào lịch sử phiên âm
      session.transcriptHistory.push({
        sender: 'CANDIDATE',
        text: defenseText,
        timestamp: new Date().toLocaleTimeString(),
      });

      this.logger.log(`[LUOT ${session.currentTurn}/${session.totalTurns}] [THI SINH PHAN BIEN]: "${defenseText}"`);

      // 2. Đưa phát ngôn của thí sinh vào Hội đồng MAD Chamber & ArbiterService phán quyết
      const verdict = await this.arbiterService.evaluateDefense(session, defenseText);
      session.lastVerdict = verdict;

      // Lưu chi tiết các câu thoại của Hội đồng MAD Chamber vào transcriptHistory
      if (verdict.prosecutorArgument) {
        session.transcriptHistory.push({
          sender: 'PROSECUTOR',
          agentName: 'Công tố viên',
          text: verdict.prosecutorArgument,
          timestamp: new Date().toLocaleTimeString(),
        });
      }

      if (verdict.defenderArgument) {
        session.transcriptHistory.push({
          sender: 'DEFENDER',
          agentName: 'Người bào chữa',
          text: verdict.defenderArgument,
          timestamp: new Date().toLocaleTimeString(),
        });
      }

      session.transcriptHistory.push({
        sender: 'ARBITER',
        agentName: 'Chủ tọa Hội đồng',
        text: verdict.reason,
        timestamp: new Date().toLocaleTimeString(),
        penaltyApplied: verdict.hpDelta,
        score: verdict.score.overallScore,
      });

      // Cập nhật máu theo phán quyết của Arbiter (có sàn tân thủ 20% và thưởng hồi máu)
      if (verdict.hpDelta > 0) {
        session.candidateHp = Math.min(100, session.candidateHp + verdict.hpDelta);
      } else if (verdict.hpDelta < 0) {
        this.fsmService.deductHp(sessionId, Math.abs(verdict.hpDelta));
      }

      // Phát sự kiện Phán quyết chính thức S2C_VERDICT_ANNOUNCED
      const verdictPayload: S2CVerdictAnnouncedPayload = {
        verdict,
        candidateHp: session.candidateHp,
      };
      this.server
        .to(sessionId)
        .emit(ArenaSocketEvents.S2C_VERDICT_ANNOUNCED, verdictPayload);

      // 3. Phân tích điều hướng với FollowUpEngine
      const evalResult = this.followUpEngine.evaluateCandidateSpeech(defenseText);
      const isWeak = verdict.score.overallScore < 55 || evalResult.isVague;
      const decision = this.followUpEngine.decideNextMove(
        session.followUpCount || 0,
        session.currentTopic || 'Bài toán giá bán & Chi phí vận hành',
        {
          isVague: isWeak,
          isDefensive: evalResult.isDefensive,
          hasNumbers: verdict.score.factualBacking >= 60 || evalResult.hasNumbers,
          wordCount: evalResult.wordCount,
        },
        session.activeBossId,
        session.availableBossIds
      );

      session.followUpCount = decision.followUpCount;
      session.currentTopic = decision.topic;

      // 4. Nếu là Coaching Pivot (Strike 2), cảnh báo qua S2C_COACHING_ALERT
      if (decision.action === 'COACHING_PIVOT') {
        session.isCoachingPivot = true;
        const coachingPayload: S2CCoachingAlertPayload = {
          bossId: session.activeBossId,
          topic: decision.topic,
          strikeCount: 2,
          message:
            'Giám khảo nhận thấy bạn đang gặp khó khăn ở chủ đề này. Kích hoạt hướng dẫn gợi mở mang tính xây dựng.',
        };
        this.server
          .to(sessionId)
          .emit(ArenaSocketEvents.S2C_COACHING_ALERT, coachingPayload);
      } else {
        session.isCoachingPivot = false;
        if (decision.action === 'NEW_QUESTION') {
          session.activeBossId = decision.suggestedBossId;
        }
      }

      // Đồng bộ trạng thái mới
      this.server.to(sessionId).emit(ArenaSocketEvents.S2C_SESSION_SYNC, this.sanitizeSessionForClient(session));

      // 5. Kích hoạt Boss đặt câu hỏi mới / Follow-up / Coaching
      setTimeout(() => {
        this.triggerBossQuestioning(sessionId);
      }, 600);
    } catch (err: any) {
      this.logger.error(`Error in handleSubmitDefense: ${err.message}`);
    }
  }

  /**
   * Yêu cầu chủ động câu hỏi tiếp theo
   */
  @SubscribeMessage(ArenaSocketEvents.C2S_REQUEST_NEXT_QUESTION)
  handleRequestNextQuestion(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawPayload: unknown
  ) {
    try {
      const { sessionId } = C2SRequestNextQuestionPayloadSchema.parse(rawPayload);
      this.triggerBossQuestioning(sessionId);
    } catch (err: any) {
      this.logger.error(`Error in handleRequestNextQuestion: ${err.message}`);
    }
  }

  /**
   * Tiếp nhận bản phiên âm giọng nói trực tiếp (Live Subtitles)
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
      const session = this.fsmService.getSession(sessionId);
      if (!session) return;

      const livePayload = {
        sender: 'CANDIDATE' as const,
        text,
        isFinal,
        timestamp: new Date().toLocaleTimeString(),
      };

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
   * Kích hoạt Giám khảo đặt câu hỏi và Stream chữ qua WebSocket
   */
  private async triggerBossQuestioning(sessionId: string) {
    const session = this.fsmService.getSession(sessionId);
    const timer = this.fsmService.getTimer(sessionId);
    if (!session || !timer) return;

    // Đóng băng đồng hồ khi Boss đang đặt câu hỏi (Time Freeze)
    timer.freeze('BOSS_STREAMING_QUESTION');
    this.fsmService.transitionState(sessionId, SessionFsmState.BOSS_QUESTIONING);
    // Đảm bảo Giám khảo chất vấn luôn thuộc khối đề mục có thực sự trong tài liệu
    if (
      session.availableBossIds &&
      session.availableBossIds.length > 0 &&
      !session.availableBossIds.includes(session.activeBossId)
    ) {
      session.activeBossId = session.availableBossIds[0];
    }

    session.isStreamingQuestion = true;
    session.activeQuestion = '';

    const freezePayload: S2CTimeFreezePayload = {
      isFrozen: true,
      reason: 'BOSS_STREAMING',
    };
    this.server.to(sessionId).emit(ArenaSocketEvents.S2C_TIME_FREEZE, freezePayload);
    this.server.to(sessionId).emit(ArenaSocketEvents.S2C_SESSION_SYNC, this.sanitizeSessionForClient(session));

    const candidateLastSpeech =
      session.transcriptHistory.length > 0
        ? session.transcriptHistory[session.transcriptHistory.length - 1].text
        : '';

    let accumulatedQuestion = '';

    await this.geminiService.streamBossQuestion({
      bossId: session.activeBossId,
      ragContext: `Dự án document ID: ${session.documentId}. Chủ đề chính: ${session.currentTopic || 'Chi phí vận hành & Giá bán'}.`,
      candidateSpeech: candidateLastSpeech,
      isFollowUp: (session.followUpCount || 0) > 0,
      followUpTopic: session.currentTopic,
      isCoachingPivot: session.isCoachingPivot,
      preset: session.config.evaluationPreset,
      onChunk: (chunk: string) => {
        accumulatedQuestion += chunk;
        const chunkPayload: S2CBossStreamChunkPayload = {
          bossId: session.activeBossId,
          chunk,
          isComplete: false,
          accumulatedText: accumulatedQuestion,
        };
        this.server
          .to(sessionId)
          .emit(ArenaSocketEvents.S2C_BOSS_STREAM_CHUNK, chunkPayload);
      },
      onComplete: (fullText: string) => {
        session.activeQuestion = fullText;
        session.isStreamingQuestion = false;

        const completePayload: S2CBossStreamChunkPayload = {
          bossId: session.activeBossId,
          chunk: '',
          isComplete: true,
          accumulatedText: fullText,
        };
        this.server
          .to(sessionId)
          .emit(ArenaSocketEvents.S2C_BOSS_STREAM_CHUNK, completePayload);

        const bossProfile = JURY_BOSS_PROFILES[session.activeBossId];
        const bossName = bossProfile?.name || session.activeBossId;

        // Lưu câu hỏi của Boss vào transcript
        session.transcriptHistory.push({
          sender: 'BOSS',
          bossId: session.activeBossId,
          agentName: bossName,
          text: fullText,
          timestamp: new Date().toLocaleTimeString(),
          isCoachingPivot: session.isCoachingPivot,
        });

        const turnTag = session.isCoachingPivot
          ? '[COACHING PIVOT]'
          : (session.followUpCount || 0) > 0
          ? `[FOLLOW-UP LAN ${session.followUpCount}]`
          : '[CAU HOI MOI]';

        this.logger.log(
          `[LUOT ${session.currentTurn}/${session.totalTurns}] [GIAM KHAO: ${bossName}] ${turnTag} Topic: "${session.currentTopic || 'Chung'}" | Cau hoi: "${fullText}"`
        );

        // Bỏ đóng băng đồng hồ, đặt lại thời gian lượt thi đấu đầy đủ cho thí sinh đối chất
        timer.resetTurnTimer(session.config.roundDurationSeconds);
        timer.unfreeze();
        this.fsmService.transitionState(sessionId, SessionFsmState.COMBAT_ACTIVE);
        session.turnRemainingSeconds = session.config.roundDurationSeconds;

        const unfreezePayload: S2CTimeFreezePayload = {
          isFrozen: false,
          reason: 'RESUMED',
        };
        this.server.to(sessionId).emit(ArenaSocketEvents.S2C_TIME_FREEZE, unfreezePayload);
        this.server.to(sessionId).emit(ArenaSocketEvents.S2C_SESSION_SYNC, this.sanitizeSessionForClient(session));
      },
      onError: () => {
        timer.unfreeze();
        this.fsmService.transitionState(sessionId, SessionFsmState.COMBAT_ACTIVE);
      },
    });
  }

  /**
   * Xử lý khi hết thời gian 30s của lượt
   */
  private handleTurnTimeOut(sessionId: string) {
    const session = this.fsmService.getSession(sessionId);
    const timer = this.fsmService.getTimer(sessionId);
    if (!session || !timer) return;

    this.logger.log(`[${sessionId}] Turn time expired!`);

    // Tự động chuyển lượt tiếp theo hoặc kết thúc
    if (session.currentTurn < session.totalTurns) {
      session.currentTurn += 1;
      this.triggerBossQuestioning(sessionId);
    } else {
      this.fsmService.transitionState(sessionId, SessionFsmState.EVALUATION_REPORT);
      timer.stop();
      this.server.to(sessionId).emit(ArenaSocketEvents.S2C_SESSION_SYNC, this.sanitizeSessionForClient(session));
    }
  }
}
