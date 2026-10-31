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
  S2CReportGeneratedPayload,
  getAvailableBossesForSections,
  JURY_BOSS_PROFILES,
  BOSS_TO_SECTION_MAP,
  BusinessSectionLabel,
  PitchSectionType,
  CrossGroundingContext,
  StreamPitchChunkSchema,
  FinalizePitchStreamSchema,
  C2SStreamPitchChunkPayload,
  C2SFinalizePitchStreamPayload,
  S2CPitchGraphSyncPayload,
} from '@pitcharena/shared';
import { ArenaFsmService } from '../domain/fsm/arena-fsm.service';
import { GeminiService } from '../adapters/llm/gemini.service';
import { FollowUpEngine } from '../domain/orchestrator/follow-up-engine';
import { DocumentService } from '../document/document.service';
import { ArbiterService } from '../domain/scoring/arbiter.service';
import { AppendixGeneratorService } from '../domain/reporting/appendix-generator.service';
import { RematchEngine } from '../domain/orchestrator/rematch-engine';
import { SessionPersistenceService } from '../adapters/db/session-persistence.service';
import { PitchGraphService } from '../domain/rag/pitch-graph.service';

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
  private readonly latestCandidateSpeech = new Map<string, string>();
  private readonly processingTurnLocks = new Set<string>();
  private readonly socketSessionMap = new Map<string, string>();
  private readonly sessionCleanupTimeouts = new Map<string, NodeJS.Timeout>();
  private readonly pitchAutoFinalizeTimeouts = new Map<string, NodeJS.Timeout>();

  // Thời gian ân hạn tối đa cho bài pitch (2 phút + 5s ân hạn chống treo sàn đấu theo FR-03)
  public static readonly PITCH_AUTO_FINALIZE_GRACE_MS = 125 * 1000;

  constructor(
    private readonly fsmService: ArenaFsmService,
    private readonly geminiService: GeminiService,
    private readonly followUpEngine: FollowUpEngine,
    private readonly documentService: DocumentService,
    private readonly arbiterService: ArbiterService,
    private readonly appendixGeneratorService: AppendixGeneratorService,
    private readonly rematchEngine: RematchEngine,
    private readonly sessionPersistenceService: SessionPersistenceService,
    private readonly pitchGraphService: PitchGraphService
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
    const sessionId = this.socketSessionMap.get(client.id);
    this.socketSessionMap.delete(client.id);

    if (sessionId) {
      const room = this.server?.sockets?.adapter?.rooms?.get(sessionId);
      if (!room || room.size === 0) {
        // Hủy timer cũ nếu có
        const existingTimer = this.sessionCleanupTimeouts.get(sessionId);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }

        // Lên lịch giải phóng bộ nhớ đồ thị sau 5 phút nếu client không kết nối lại
        const timeout = setTimeout(() => {
          this.clearPitchAutoFinalizeSafeguard(sessionId);
          this.pitchGraphService.removeSession(sessionId);
          this.sessionCleanupTimeouts.delete(sessionId);
          this.logger.log(`[ArenaGateway] Cleaned up PitchGraphSession for inactive session: ${sessionId}`);
        }, 5 * 60 * 1000);
        this.sessionCleanupTimeouts.set(sessionId, timeout);
      }
    }
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
      this.socketSessionMap.set(client.id, sessionId);

      // Nếu có lịch dọn dẹp đang chờ, hủy bỏ vì client đã kết nối lại
      const pendingCleanup = this.sessionCleanupTimeouts.get(sessionId);
      if (pendingCleanup) {
        clearTimeout(pendingCleanup);
        this.sessionCleanupTimeouts.delete(sessionId);
        this.logger.log(`[ArenaGateway] Cancelled scheduled cleanup for reconnected session: ${sessionId}`);
      }

      const doc = this.documentService.getDocument(documentId);
      const availableBossIds = doc ? getAvailableBossesForSections(doc.sections) : undefined;
      const session = this.fsmService.getOrCreateSession(sessionId, documentId, availableBossIds);
      this.pitchGraphService.getOrCreateSession(sessionId, documentId);

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
   * Bắt đầu trận đấu: Chuyển sang 3s Prep Buffer rồi sang Boss chất vấn
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
      this.clearPitchAutoFinalizeSafeguard(sessionId);

      const timer = this.fsmService.getTimer(sessionId);
      if (timer) {
        // Reset sạch chuỗi Streak khi bước vào trận đấu mới
        this.arbiterService.resetStreak(sessionId);
        session.streak = { count: 0, type: 'NEUTRAL' };

        // Xóa sạch các khóa lượt cũ của session này
        for (const key of this.processingTurnLocks) {
          if (key.startsWith(`${sessionId}_`)) {
            this.processingTurnLocks.delete(key);
          }
        }

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
   * Bỏ qua 3s đệm suy nghĩ -> Kích hoạt ngay Giám khảo đặt câu hỏi
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
      await this.processCandidateDefense(sessionId, defenseText);
    } catch (err: any) {
      this.logger.error(`Error in handleSubmitDefense: ${err.message}`);
    }
  }

  /**
   * Quy trình xử lý bài nộp phản biện và phán xử (dùng cho cả submit chủ động và khi hết giờ)
   */
  private async processCandidateDefense(sessionId: string, defenseText: string) {
    try {
      const session = this.fsmService.getSession(sessionId);
      const timer = this.fsmService.getTimer(sessionId);
      if (!session || !timer) return;

      // Khóa chống nộp trùng lặp cho cùng một lượt (Race condition giữa Submit và Timeout)
      const turnLockKey = `${sessionId}_${session.currentTurn}`;
      if (
        this.processingTurnLocks.has(turnLockKey) ||
        session.fsmState === SessionFsmState.TIME_FREEZE
      ) {
        this.logger.warn(
          `[${sessionId}] Lượt ${session.currentTurn} đang được xử lý phán quyết hoặc đang ở TIME_FREEZE. Bỏ qua yêu cầu nộp trùng.`
        );
        return;
      }
      this.processingTurnLocks.add(turnLockKey);

      // Xóa lời nói tạm sau khi đã tiếp nhận xử lý
      this.latestCandidateSpeech.delete(sessionId);

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
        topicId: session.currentTopicId,
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
      session.lastVerdict = verdict;
      session.verdictHistory = session.verdictHistory || [];
      session.verdictHistory.push(verdict);
      session.activeQuestion = undefined;

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

      // Nếu thí sinh đã hết máu (Knockout/0 HP) sau khi khiên đã vỡ, kết thúc trận đấu và xuất báo cáo
      if (session.candidateHp <= 0) {
        this.logger.log(
          `[${sessionId}] 💀 Thí sinh đã cạn máu (0 HP) ở lượt ${session.currentTurn} -> Kết thúc trận đấu sớm (Knockout).`
        );
        this.finishMatchAndGenerateReport(sessionId);
        return;
      }

      // 3. Phân tích điều hướng với FollowUpEngine
      const evalResult = this.followUpEngine.evaluateCandidateSpeech(defenseText);
      const isWeak = verdict.score.overallScore < 55 || evalResult.isVague;
      const decision = this.followUpEngine.decideNextMove(
        session.followUpCount || 0,
        session.currentTopic || this.followUpEngine.getDefaultTopicForBoss(session.activeBossId),
        {
          isVague: isWeak,
          isDefensive: evalResult.isDefensive,
          hasNumbers: verdict.score.factualBacking >= 60 || evalResult.hasNumbers,
          wordCount: evalResult.wordCount,
        },
        session.activeBossId,
        session.availableBossIds,
        session.isCoachingPivot,
        undefined,
        session.usedTopicIds || []
      );

      session.followUpCount = decision.followUpCount;
      session.currentTopic = decision.topic;
      if (decision.topicId) {
        session.currentTopicId = decision.topicId;
        if (!session.usedTopicIds) {
          session.usedTopicIds = [];
        }
        if (!session.usedTopicIds.includes(decision.topicId)) {
          session.usedTopicIds.push(decision.topicId);
        }
      }

      // 4. Kiểm tra xem trận đấu đã hết lượt hay chưa
      // Nếu là câu hỏi mới (NEW_QUESTION) hoặc đã qua Coaching Pivot:
      if (decision.action === 'NEW_QUESTION') {
        session.isCoachingPivot = false;
        session.activeBossId = decision.suggestedBossId;
        // Chuyển sang lượt chất vấn tiếp theo
        session.currentTurn += 1;
      } else if (decision.action === 'COACHING_PIVOT') {
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
      }

      // Nếu đã vượt quá tổng số lượt quy định, kết thúc trận đấu chuyển sang Báo cáo Tổng kết
      if (session.currentTurn > session.totalTurns) {
        this.finishMatchAndGenerateReport(sessionId);
        return;
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
   * Yêu cầu chủ động câu hỏi tiếp theo (Bỏ qua câu hỏi / Skip)
   */
  @SubscribeMessage(ArenaSocketEvents.C2S_REQUEST_NEXT_QUESTION)
  async handleRequestNextQuestion(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawPayload: unknown
  ) {
    try {
      const { sessionId } = C2SRequestNextQuestionPayloadSchema.parse(rawPayload);
      const session = this.fsmService.getSession(sessionId);
      if (!session) return;

      // Nếu đang trong lượt đối chất mà câu hỏi hiện tại chưa được trả lời:
      // Thí sinh chủ động bỏ qua câu hỏi -> Phạt trừ điểm ngay tại thời điểm bỏ qua!
      const isUnanswered =
        Boolean(session.activeQuestion) &&
        (session.fsmState === SessionFsmState.COMBAT_ACTIVE ||
         session.fsmState === SessionFsmState.PREP_BUFFER);

      if (isUnanswered) {
        this.logger.log(`[${sessionId}] Thí sinh chủ động bỏ qua câu hỏi khi chưa hết giờ -> Phạt trừ điểm ngay tại chỗ.`);
        const pendingSpeech = this.latestCandidateSpeech.get(sessionId)?.trim();
        const defenseText = pendingSpeech || 'Thí sinh bỏ qua câu hỏi chất vấn.';
        await this.processCandidateDefense(sessionId, defenseText);
        return;
      }

      // Nếu không có câu hỏi nào đang dở dang thì kích hoạt câu hỏi mới
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

      if (text.trim()) {
        this.latestCandidateSpeech.set(sessionId, text.trim());
      }
    } catch (err: any) {
      this.logger.error(`Error in handleSubmitTranscript: ${err.message}`);
    }
  }

  /**
   * Tiếp nhận Chunk phát biểu theo nhịp thở từ thí sinh ở Bước 3 (FR-01, FR-02, AD-2)
   */
  @SubscribeMessage(ArenaSocketEvents.C2S_STREAM_PITCH_CHUNK)
  async handleStreamPitchChunk(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawPayload: unknown
  ) {
    try {
      const parsed = StreamPitchChunkSchema.safeParse(rawPayload);
      if (!parsed.success) {
        this.logger.warn(`[PitchChunk] Validation failed: ${parsed.error.message}`);
        return;
      }
      const payload: C2SStreamPitchChunkPayload = parsed.data;

      // Kích hoạt Server Auto-Finalize Safeguard (FR-03) nếu chưa có timer cho session này
      if (!this.pitchAutoFinalizeTimeouts.has(payload.sessionId)) {
        this.armPitchAutoFinalizeSafeguard(payload.sessionId);
      }

      const syncData = await this.pitchGraphService.processStreamPitchChunk(payload);
      this.server
        .to(payload.sessionId)
        .emit(ArenaSocketEvents.S2C_PITCH_GRAPH_SYNC, syncData);
    } catch (err: any) {
      this.logger.error(`Error in handleStreamPitchChunk: ${err.message}`);
    }
  }

  /**
   * Khóa bài thuyết trình và hoàn tất đồ thị In-Memory (FR-03, AD-5)
   */
  @SubscribeMessage(ArenaSocketEvents.C2S_FINALIZE_PITCH_STREAM)
  async handleFinalizePitchStream(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawPayload: unknown
  ) {
    try {
      const parsed = FinalizePitchStreamSchema.safeParse(rawPayload);
      if (!parsed.success) {
        this.logger.warn(`[FinalizePitch] Validation failed: ${parsed.error.message}`);
        return;
      }
      const payload: C2SFinalizePitchStreamPayload = parsed.data;
      this.clearPitchAutoFinalizeSafeguard(payload.sessionId);
      const syncData = await this.pitchGraphService.finalizePitchStream(payload);
      this.server
        .to(payload.sessionId)
        .emit(ArenaSocketEvents.S2C_PITCH_GRAPH_SYNC, syncData);
      this.logger.log(`[FinalizePitch] Pitch finalized for session ${payload.sessionId}`);
    } catch (err: any) {
      this.logger.error(`Error in handleFinalizePitchStream: ${err.message}`);
    }
  }

  /**
   * Yêu cầu xem lại hoặc tải Báo cáo Phụ lục Hành động
   */
  @SubscribeMessage(ArenaSocketEvents.C2S_REQUEST_REPORT)
  handleRequestReport(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawPayload: unknown
  ) {
    try {
      const { sessionId } = C2SSessionActionPayloadSchema.parse(rawPayload);
      const session = this.fsmService.getSession(sessionId);
      if (!session) return;

      let report = session.report || this.sessionPersistenceService.getReport(sessionId);
      if (!report) {
        const doc = this.documentService.getDocument(session.documentId);
        report = this.appendixGeneratorService.generateReport(
          session,
          doc?.filename || 'Đề án Khởi nghiệp Sinh viên'
        );
        session.report = report;
        this.sessionPersistenceService.saveReport(sessionId, report);
      }

      const reportPayload: S2CReportGeneratedPayload = {
        sessionId,
        report,
      };
      client.emit(ArenaSocketEvents.S2C_REPORT_GENERATED, reportPayload);
    } catch (err: any) {
      this.logger.error(`Error in handleRequestReport: ${err.message}`);
    }
  }

  /**
   * Kích hoạt Vòng Tái đấu Nhanh (Quick Re-match Loop)
   * Giữ nguyên tài liệu đã nạp, nạp bộ đệm câu hỏi cũ vào RematchEngine để không lặp lại
   */
  @SubscribeMessage(ArenaSocketEvents.C2S_REQUEST_REMATCH)
  handleRequestRematch(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawPayload: unknown
  ) {
    try {
      const { sessionId } = C2SSessionActionPayloadSchema.parse(rawPayload);
      const session = this.fsmService.getSession(sessionId);
      if (!session) return;

      const timer = this.fsmService.getTimer(sessionId);
      if (timer) timer.stop();
      this.clearPitchAutoFinalizeSafeguard(sessionId);

      // Ghi nhận toàn bộ câu hỏi của trận trước vào RematchEngine
      const askedQuestions = session.transcriptHistory
        .filter((t) => t.sender === 'BOSS' && t.text.trim())
        .map((t) => t.text.trim());
      this.rematchEngine.recordQuestions(session.documentId, askedQuestions);

      // Reset các chỉ số cho trận tái đấu mới
      this.arbiterService.resetStreak(sessionId);
      session.streak = { count: 0, type: 'NEUTRAL' };

      // Xóa sạch các khóa lượt cũ của session này
      for (const key of this.processingTurnLocks) {
        if (key.startsWith(`${sessionId}_`)) {
          this.processingTurnLocks.delete(key);
        }
      }

      session.candidateHp = 100;
      session.currentTurn = 1;
      session.followUpCount = 0;
      session.currentTopic = undefined;
      session.currentTopicId = undefined;
      session.usedTopicIds = [];
      session.isCoachingPivot = false;
      session.lastVerdict = undefined;
      session.verdictHistory = [];
      session.report = undefined;
      session.transcriptHistory = [];
      session.prepRemainingSeconds = session.config.prepBufferSeconds;
      session.turnRemainingSeconds = session.config.roundDurationSeconds;
      session.isPaused = false;
      session.isTimeFrozen = false;
      session.isStreamingQuestion = false;
      session.activeQuestion = undefined;

      // Reset đồ thị tri thức In-Memory
      this.pitchGraphService.removeSession(sessionId);
      this.pitchGraphService.getOrCreateSession(sessionId, session.documentId);
      const resetGraphSync = this.pitchGraphService.getGraphSyncPayload(sessionId);
      this.server.to(sessionId).emit(ArenaSocketEvents.S2C_PITCH_GRAPH_SYNC, resetGraphSync);

      this.fsmService.transitionState(sessionId, SessionFsmState.LOBBY_READY);

      this.server.to(sessionId).emit(ArenaSocketEvents.S2C_SESSION_SYNC, this.sanitizeSessionForClient(session));
      this.logger.log(`[${sessionId}] ↺ Kích hoạt Tái đấu Nhanh (Quick Re-match) thành công!`);
    } catch (err: any) {
      this.logger.error(`Error in handleRequestRematch: ${err.message}`);
    }
  }

  /**
   * Kết thúc trận đấu chủ động từ phía client
   */
  @SubscribeMessage(ArenaSocketEvents.C2S_FINISH_COMBAT)
  async handleFinishCombat(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawPayload: unknown
  ) {
    try {
      const { sessionId } = C2SSessionActionPayloadSchema.parse(rawPayload);
      this.logger.log(`[${sessionId}] Nhận yêu cầu kết thúc trận đấu (C2S_FINISH_COMBAT)`);
      const session = this.fsmService.getSession(sessionId);

      if (session) {
        // Kiểm tra nếu câu hỏi hiện tại chưa được phản biện/phán quyết
        const isUnanswered =
          Boolean(session.activeQuestion) &&
          (session.fsmState === SessionFsmState.COMBAT_ACTIVE ||
           session.fsmState === SessionFsmState.PREP_BUFFER);

        if (isUnanswered) {
          this.logger.log(`[${sessionId}] Kết thúc đối chất khi câu hỏi còn dở -> Phạt trừ điểm câu hỏi chưa trả lời trước khi tổng kết.`);
          const pendingSpeech = this.latestCandidateSpeech.get(sessionId)?.trim();
          const defenseText = pendingSpeech || 'Thí sinh bỏ qua câu hỏi (Kết thúc đối chất sớm).';

          // Đánh giá và trừ HP cho câu hỏi này trước
          const verdict = await this.arbiterService.evaluateDefense(session, defenseText);
          session.lastVerdict = verdict;
          session.verdictHistory = session.verdictHistory || [];
          session.verdictHistory.push(verdict);
          session.activeQuestion = undefined;

          // Ghi nhận transcript
          session.transcriptHistory.push({
            sender: 'CANDIDATE',
            text: defenseText,
        topicId: session.currentTopicId,
            timestamp: new Date().toLocaleTimeString(),
          });
          if (verdict.prosecutorArgument) {
            session.transcriptHistory.push({
              sender: 'PROSECUTOR',
              agentName: 'Công tố viên',
              text: verdict.prosecutorArgument,
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

          if (verdict.hpDelta < 0) {
            this.fsmService.deductHp(sessionId, Math.abs(verdict.hpDelta));
          }

          // Phát phán quyết
          this.server.to(sessionId).emit(ArenaSocketEvents.S2C_VERDICT_ANNOUNCED, {
            verdict,
            candidateHp: session.candidateHp,
          });
        }
      }

      this.finishMatchAndGenerateReport(sessionId);
    } catch (err: any) {
      this.logger.error(`Error in handleFinishCombat: ${err.message}`);
    }
  }

  /**
   * Kết thúc trận đấu, tổng hợp Báo cáo Phụ lục và lưu trữ
   */
  private finishMatchAndGenerateReport(sessionId: string) {
    const session = this.fsmService.getSession(sessionId);
    const timer = this.fsmService.getTimer(sessionId);
    if (!session) return;

    if (timer) timer.stop();
    this.fsmService.transitionState(sessionId, SessionFsmState.EVALUATION_REPORT);

    const doc = this.documentService.getDocument(session.documentId);
    const report = this.appendixGeneratorService.generateReport(
      session,
      doc?.filename || 'Đề án Khởi nghiệp Sinh viên'
    );
    session.report = report;

    // Lưu vào kho lưu trữ vĩnh viễn
    this.sessionPersistenceService.saveSession(session);
    this.sessionPersistenceService.saveReport(sessionId, report);

    // Ghi nhận câu hỏi vào RematchEngine
    const askedQuestions = session.transcriptHistory
      .filter((t) => t.sender === 'BOSS' && t.text.trim())
      .map((t) => t.text.trim());
    this.rematchEngine.recordQuestions(session.documentId, askedQuestions);

    this.server.to(sessionId).emit(ArenaSocketEvents.S2C_SESSION_SYNC, this.sanitizeSessionForClient(session));
    this.server.to(sessionId).emit(ArenaSocketEvents.S2C_REPORT_GENERATED, {
      sessionId,
      report,
    });
    this.logger.log(`[${sessionId}] 🎉 Trận đấu kết thúc -> Đã phát S2C_REPORT_GENERATED`);
  }

  /**
   * Kích hoạt Giám khảo đặt câu hỏi và Stream chữ qua WebSocket
   */
  private async triggerBossQuestioning(sessionId: string) {
    const session = this.fsmService.getSession(sessionId);
    const timer = this.fsmService.getTimer(sessionId);
    if (!session || !timer) return;

    // Đảm bảo Giám khảo chất vấn luôn thuộc danh sách khả dụng
    if (
      session.availableBossIds &&
      session.availableBossIds.length > 0 &&
      !session.availableBossIds.includes(session.activeBossId)
    ) {
      session.activeBossId = session.availableBossIds[0];
    }

    // Đảm bảo chủ đề hiện tại luôn khớp với chuyên môn của Boss và đa dạng ngẫu nhiên giữa các phiên
    if (!session.currentTopic) {
      const initialTopic = this.followUpEngine.getTopicForBoss(
        session.activeBossId,
        session.usedTopicIds || []
      );
      session.currentTopic = initialTopic.topic;
      session.currentTopicId = initialTopic.topicId;
      if (!session.usedTopicIds) {
        session.usedTopicIds = [];
      }
      if (!session.usedTopicIds.includes(initialTopic.topicId)) {
        session.usedTopicIds.push(initialTopic.topicId);
      }
    }

    // Đóng băng đồng hồ khi Boss đang đặt câu hỏi (Time Freeze)
    timer.freeze('BOSS_STREAMING_QUESTION');
    this.fsmService.transitionState(sessionId, SessionFsmState.BOSS_QUESTIONING);

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

    // Trích xuất nội dung thực tế từ tài liệu theo chuyên môn của Giám khảo đang chất vấn
    let docContext = '';
    let foundationContext = '';
    let relevantSectionTitles: string[] = [];
    const doc = this.documentService.getDocument(session.documentId);
    if (doc) {
      if (doc.foundationFacts) {
        const ff = doc.foundationFacts;
        foundationContext = `[ĐỊNH VỊ NỀN TẢNG DỰ ÁN]:
- Đối tượng khách hàng mục tiêu: ${ff.targetCustomerSummary} (Trạng thái: ${ff.isCustomerExplicit ? 'ĐÃ NÊU RÕ TRONG BÁO CÁO' : 'CHƯA NÊU RÕ / BỎ NGỎ'})
- Mô hình doanh thu & Dòng tiền: ${ff.revenueModelSummary} (Trạng thái: ${ff.isRevenueModelExplicit ? 'ĐÃ NÊU RÕ TRONG BÁO CÁO' : 'CHƯA NÊU RÕ / BỎ NGỎ'})
- Phân loại sản phẩm: ${ff.productType} | Giai đoạn hiện tại: ${ff.productStage} (Trạng thái: ${ff.isStageExplicit ? 'ĐÃ XÁC ĐỊNH' : 'MỚI LÀ Ý TƯỞNG / CHƯA RÕ RÀNG'})
- Lợi thế cạnh tranh: ${ff.hasIdentifiedMoat ? ff.moatSummary : 'Chưa có lợi thế phòng thủ rõ ràng'}
- Lộ trình phát triển: ${ff.hasExecutionRoadmap ? 'Đã có các mốc thời gian' : 'Chưa có lộ trình cụ thể'}`;
      }

      const relevantSectionTypes = BOSS_TO_SECTION_MAP[session.activeBossId] || [];
      const relevantSections = doc.sections.filter(
        (s) =>
          relevantSectionTypes.includes(s.type) &&
          s.content &&
          !s.content.includes('Chưa phát hiện nội dung rõ ràng')
      );
      relevantSectionTitles = relevantSections.map(
        (s) => `[${s.type}] ${s.title || BusinessSectionLabel[s.type] || s.type}`
      );

      if (relevantSections.length > 0) {
        docContext = relevantSections
          .map((s) => `[ĐỀ MỤC: ${s.title || s.type}]\n${s.content.slice(0, 2000)}`)
          .join('\n\n');
        
        // Nếu đề mục quá ngắn (dưới 150 ký tự), bổ sung thêm một phần nội dung tổng thể của đề án
        if (docContext.length < 150 && doc.markdownContent) {
          docContext += `\n\n[NỘI DUNG TỔNG THỂ ĐỀ ÁN]:\n${doc.markdownContent.slice(0, 1500)}`;
        }
      } else {
        docContext = `[NỘI DUNG TỔNG THỂ ĐỀ ÁN]:\n${doc.markdownContent.slice(0, 2500)}`;
      }

      // Bổ sung các con số, tên thực thể đã trích xuất được trong đề mục này (Entity Whitelist)
      const relevantEntities = (doc.entityWhitelist || [])
        .filter((e) => relevantSectionTypes.includes(e.sectionType))
        .slice(0, 6);
      if (relevantEntities.length > 0) {
        const entityList = relevantEntities
          .map((e) => `- ${e.rawText} (${e.category}): "${e.contextSentence.slice(0, 120)}"`)
          .join('\n');
        docContext += `\n\n[CÁC CON SỐ & THỰC THỂ ĐÃ BÓC TÁCH TỪ ĐỀ MỤC NÀY]:\n${entityList}`;
      }
    }

    // 3. Trích xuất dữ liệu Pitch Graph thời gian thực (chỉ lấy Node ACTIVE, loại bỏ SUPERSEDED)
    const pitchGraph = this.pitchGraphService.getSession(sessionId);
    let crossGroundingContext: CrossGroundingContext | undefined;
    let pitchGraphContextText = '';

    if (pitchGraph) {
      session.hasSection6 = pitchGraph.hasSection6;
      session.section6Title = pitchGraph.section6Title;
      session.isPivotDetected = pitchGraph.isPivotDetected;

      // Graceful Fallback: Nếu dữ liệu Pitch chưa sẵn sàng ở Turn 1 -> Fallback hỏi bản Word
      const isPitchReady = pitchGraph.isFinalized || session.currentTurn > 1;

      if (isPitchReady) {
        const activeNodes = pitchGraph.getActiveNodes();
        const refinedNodes = pitchGraph.getRefinedNodes();
        const section6Nodes = activeNodes.filter(
          (n) => n.sectionType === PitchSectionType.DYNAMIC_EXPANDED_SCOPE
        );

        crossGroundingContext = {
          refinedNodes: refinedNodes.map((n) => ({
            id: n.id,
            key: n.key,
            value: n.value,
            sectionType: n.sectionType,
            source: n.source,
          })),
          section6Nodes: section6Nodes.map((n) => ({
            id: n.id,
            key: n.key,
            value: n.value,
            sectionType: n.sectionType,
          })),
          isPivotDetected: pitchGraph.isPivotDetected,
          section6Title: pitchGraph.section6Title,
        };

        if (refinedNodes.length > 0 || section6Nodes.length > 0 || pitchGraph.isPivotDetected) {
          pitchGraphContextText = `\n\n[DỮ LIỆU ĐỒ THỊ PITCH GRAPHRAG (THỜI GIAN THỰC - CHỈ LẤY NODE ACTIVE)]:`;
          if (pitchGraph.isPivotDetected) {
            pitchGraphContextText += `\n⚠️ CỜ BẺ LÁI ĐỀ ÁN: [FLAG_MAJOR_PROPOSAL_PIVOT] (Bài nói khác biệt/phủ nhận > 80% so với bản Word)`;
          }
          if (refinedNodes.length > 0) {
            pitchGraphContextText += `\n- CÁC ĐIỂM ĐÍNH CHÍNH / THAY ĐỔI TRỰC TIẾP TRONG BÀI PITCH:\n` +
              refinedNodes.map((n) => `  + [${n.sectionType}] ${n.key}: "${n.value}"`).join('\n');
          }
          if (section6Nodes.length > 0) {
            pitchGraphContextText += `\n- KHỐI 6 PHÁT SINH MỚI NGOÀI BẢN WORD: "${pitchGraph.section6Title || 'Ý tưởng mở rộng'}"\n` +
              section6Nodes.map((n) => `  + [KHỐI 6] ${n.key}: "${n.value}"`).join('\n');
          }
        }
      } else {
        this.logger.log(
          `[${sessionId}] [Graceful Fallback] Dữ liệu Pitch Graph chưa hoàn tất ở Turn 1 -> Khởi động bằng dữ liệu nền tảng bản Word.`
        );
      }
    }

    const ragContext = `Tên đề án: ${doc?.filename || session.documentId}
Chủ đề chất vấn hiện tại: ${session.currentTopic}
${foundationContext ? `${foundationContext}\n` : ''}
DỮ LIỆU ĐÃ BÓC TÁCH TỪ ĐỀ MỤC TƯƠNG ỨNG TRONG BẢN WORD:
${docContext || 'Chưa tìm thấy đoạn trích chi tiết.'}${pitchGraphContextText}`;

    let accumulatedQuestion = '';

    // Thu thập danh sách các câu hỏi trước đó (cả các phiên trước lẫn phiên hiện tại) để cấm AI đặt câu hỏi trùng lặp ý (>= 80%)
    const priorMatchQuestions = this.rematchEngine.getPreviousQuestions(session.documentId);
    const currentMatchQuestions = session.transcriptHistory
      .filter((t) => t.sender === 'BOSS' && t.text.trim())
      .map((t) => t.text.trim());
    const previousQuestions = Array.from(new Set([...priorMatchQuestions, ...currentMatchQuestions]));

    // Trích xuất các cặp [Hỏi - Đáp] đã hoàn tất từ lịch sử transcript để cấm AI hỏi lặp lại các vấn đề thí sinh đã giải trình
    const resolvedQAPairs: Array<{ bossName?: string; question: string; candidateAnswer: string }> = [];
    for (let i = 0; i < session.transcriptHistory.length; i++) {
      const item = session.transcriptHistory[i];
      if (item.sender === 'BOSS' && item.text?.trim()) {
        for (let j = i + 1; j < session.transcriptHistory.length; j++) {
          const nextItem = session.transcriptHistory[j];
          if (nextItem.sender === 'CANDIDATE' && nextItem.text?.trim()) {
            resolvedQAPairs.push({
              bossName: item.agentName || (item.bossId ? JURY_BOSS_PROFILES[item.bossId]?.name : undefined) || 'Giám khảo',
              question: item.text.trim(),
              candidateAnswer: nextItem.text.trim(),
            });
            break;
          }
          if (nextItem.sender === 'BOSS') break;
        }
      }
    }

    await this.geminiService.streamBossQuestion({
      bossId: session.activeBossId,
      ragContext,
      candidateSpeech: candidateLastSpeech,
      isFollowUp: (session.followUpCount || 0) > 0,
      followUpTopic: session.currentTopic,
      topicId: session.currentTopicId,
      isCoachingPivot: session.isCoachingPivot,
      preset: session.config.evaluationPreset,
      previousQuestions,
      crossGroundingContext,
      resolvedQAPairs,
      onChunk: (chunk: string) => {
        accumulatedQuestion += chunk;
        // Tự động làm sạch tiền tố số thứ tự như "1. ", "1. Thầy/Cô: ", "Câu 1: " nếu AI vô tình sinh ra
        const cleanedText = accumulatedQuestion.replace(/^(\d+[\.\)]\s*(?:Thầy\/Cô[:\s]*|Thầy[:\s]*|Cô[:\s]*|Tôi[:\s]*)?|Câu\s*\d+[:\.\)]\s*|[-*#]\s*)/i, '');
        const chunkPayload: S2CBossStreamChunkPayload = {
          bossId: session.activeBossId,
          chunk,
          isComplete: false,
          accumulatedText: cleanedText,
        };
        this.server
          .to(sessionId)
          .emit(ArenaSocketEvents.S2C_BOSS_STREAM_CHUNK, chunkPayload);
      },
      onComplete: (fullText: string) => {
        const cleanedFullText = fullText
          .replace(/^(\d+[\.\)]\s*(?:Thầy\/Cô[:\s]*|Thầy[:\s]*|Cô[:\s]*|Tôi[:\s]*)?|Câu\s*\d+[:\.\)]\s*|[-*#]\s*)/i, '')
          .trim();
        session.activeQuestion = cleanedFullText;
        session.isStreamingQuestion = false;

        const completePayload: S2CBossStreamChunkPayload = {
          bossId: session.activeBossId,
          chunk: '',
          isComplete: true,
          accumulatedText: cleanedFullText,
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
          text: cleanedFullText,
          timestamp: new Date().toLocaleTimeString(),
          topicId: session.currentTopicId,
          isCoachingPivot: session.isCoachingPivot,
        });

        const turnTag = session.isCoachingPivot
          ? '[COACHING PIVOT]'
          : (session.followUpCount || 0) > 0
          ? `[FOLLOW-UP LAN ${session.followUpCount}]`
          : '[CAU HOI MOI]';

        this.fsmService.logJudgeQuestionBasis(session, {
          topic: session.currentTopic,
          activeQuestion: cleanedFullText,
          sectionNames: relevantSectionTitles,
        });

        // FR-5: Kiểm tra độ trùng lặp câu hỏi (ngưỡng >= 80% similarity) với các vòng đấu trước
        const similarityCheck = this.rematchEngine.isQuestionTooSimilar(session.documentId, fullText, 0.8);
        if (similarityCheck.isDuplicate) {
          this.logger.warn(
            `[${sessionId}] ⚠️ [FR-5 Filter] Phát hiện câu hỏi tương đồng cao (${(similarityCheck.similarity * 100).toFixed(1)}% >= 80%) so với câu hỏi cũ: "${similarityCheck.matchedQuestion?.slice(0, 60)}...". Điều hướng chủ đề tiếp theo.`
          );
          const initialTopic = this.followUpEngine.getTopicForBoss(
        session.activeBossId,
        session.usedTopicIds || []
      );
      session.currentTopic = initialTopic.topic;
      session.currentTopicId = initialTopic.topicId;
      if (!session.usedTopicIds) {
        session.usedTopicIds = [];
      }
      if (!session.usedTopicIds.includes(initialTopic.topicId)) {
        session.usedTopicIds.push(initialTopic.topicId);
      }
        }

        // Bổ sung khoảng nghỉ 1.8s (tầm 1-2s) sau khi render câu hỏi xong để thí sinh đọc và chuẩn bị
        const readingPausePayload: S2CTimeFreezePayload = {
          isFrozen: true,
          reason: 'READING_BUFFER',
        };
        this.server.to(sessionId).emit(ArenaSocketEvents.S2C_TIME_FREEZE, readingPausePayload);

        setTimeout(() => {
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
        }, 1800);
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

    // Dù thí sinh đang nói dở hay hoàn toàn im lặng, khi hết giờ PHẢI xử lý bài nộp và trừ điểm:
    const pendingSpeech = this.latestCandidateSpeech.get(sessionId)?.trim();
    const defenseToProcess = pendingSpeech || 'Thí sinh không phản hồi hoặc phản hồi quá ngắn.';
    this.logger.log(`[${sessionId}] Hết giờ lượt ${session.currentTurn} -> Tự động nộp bài và phán quyết: "${defenseToProcess}"`);
    this.processCandidateDefense(sessionId, defenseToProcess);
  }

  /**
   * Kích hoạt bộ đếm giờ Server Auto-Finalize Safeguard chống treo sàn đấu (FR-03)
   * Tự động hoàn tất đồ thị sau 2 phút + 5s nếu client ngắt kết nối hoặc không gửi finalize
   */
  public armPitchAutoFinalizeSafeguard(sessionId: string, customDurationMs?: number): void {
    if (this.pitchAutoFinalizeTimeouts.has(sessionId)) {
      clearTimeout(this.pitchAutoFinalizeTimeouts.get(sessionId)!);
    }

    const durationMs = customDurationMs || ArenaGateway.PITCH_AUTO_FINALIZE_GRACE_MS;
    const timeout = setTimeout(async () => {
      this.pitchAutoFinalizeTimeouts.delete(sessionId);
      this.logger.warn(
        `[ArenaGateway] ⏰ Pitch Auto-Finalize Safeguard triggered for session ${sessionId} after ${durationMs}ms`
      );

      const graphSession = this.pitchGraphService.getSession(sessionId);
      if (!graphSession || graphSession.isFinalized) {
        return;
      }
      const syncData = await this.pitchGraphService.finalizePitchStream({
        sessionId,
        totalChunks: graphSession?.totalChunksCount || 0,
        fullRawTranscript: graphSession?.fullRawTranscript || '',
        durationSeconds: Math.round(durationMs / 1000),
      });

      this.server
        .to(sessionId)
        .emit(ArenaSocketEvents.S2C_PITCH_GRAPH_SYNC, syncData);
    }, durationMs);

    this.pitchAutoFinalizeTimeouts.set(sessionId, timeout);
  }

  /**
   * Hủy bộ đếm giờ Auto-Finalize khi client đã nộp bài thành công
   */
  public clearPitchAutoFinalizeSafeguard(sessionId: string): void {
    const timer = this.pitchAutoFinalizeTimeouts.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.pitchAutoFinalizeTimeouts.delete(sessionId);
    }
  }
}
