import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  ArenaSocketEvents,
  ArenaSessionState,
  LobbyConfig,
  S2CTimerTickPayload,
  S2CLiveTranscriptPayload,
  S2CBossStreamChunkPayload,
  S2CTimeFreezePayload,
  S2CCoachingAlertPayload,
  S2CVerdictAnnouncedPayload,
  VerdictResult,
} from '@pitcharena/shared';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';

export function useArenaSocket(sessionId: string, documentId?: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [sessionState, setSessionState] = useState<ArenaSessionState | null>(null);
  const [timerData, setTimerData] = useState<S2CTimerTickPayload | null>(null);
  const [liveTranscript, setLiveTranscript] = useState<S2CLiveTranscriptPayload | null>(null);
  const [streamingQuestion, setStreamingQuestion] = useState<S2CBossStreamChunkPayload | null>(null);
  const [lastVerdict, setLastVerdict] = useState<VerdictResult | null>(null);
  const [timeFreezeInfo, setTimeFreezeInfo] = useState<S2CTimeFreezePayload>({
    isFrozen: false,
    reason: 'RESUMED',
  });
  const [coachingAlert, setCoachingAlert] = useState<S2CCoachingAlertPayload | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(SERVER_URL, {
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 3000,
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      setConnectionError(null);

      // Tham gia vào phòng thi đấu
      socket.emit(ArenaSocketEvents.C2S_JOIN_LOBBY, {
        sessionId,
        documentId: documentId || 'doc-default',
      });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      setConnectionError(err.message);
    });

    socket.on(ArenaSocketEvents.S2C_SESSION_SYNC, (data: ArenaSessionState) => {
      setSessionState(data);
      if (data.activeQuestion && !data.isStreamingQuestion) {
        setStreamingQuestion({
          bossId: data.activeBossId,
          chunk: '',
          accumulatedText: data.activeQuestion,
          isComplete: true,
          isCoachingPivot: data.isCoachingPivot,
          topic: data.currentTopic,
        });
      }
    });

    socket.on(ArenaSocketEvents.S2C_TIMER_TICK, (data: S2CTimerTickPayload) => {
      setTimerData(data);
    });

    socket.on(ArenaSocketEvents.S2C_LIVE_TRANSCRIPT, (data: S2CLiveTranscriptPayload) => {
      setLiveTranscript(data);
    });

    socket.on(ArenaSocketEvents.S2C_BOSS_STREAM_CHUNK, (data: S2CBossStreamChunkPayload) => {
      setStreamingQuestion(data);
    });

    socket.on(ArenaSocketEvents.S2C_TIME_FREEZE, (data: S2CTimeFreezePayload) => {
      setTimeFreezeInfo(data);
    });

    socket.on(ArenaSocketEvents.S2C_COACHING_ALERT, (data: S2CCoachingAlertPayload) => {
      setCoachingAlert(data);
    });

    socket.on(ArenaSocketEvents.S2C_VERDICT_ANNOUNCED, (data: S2CVerdictAnnouncedPayload) => {
      setLastVerdict(data.verdict);
    });

    return () => {
      socket.disconnect();
    };
  }, [sessionId, documentId]);

  const updateConfig = useCallback(
    (config: LobbyConfig) => {
      if (socketRef.current && isConnected) {
        socketRef.current.emit(ArenaSocketEvents.C2S_UPDATE_CONFIG, {
          sessionId,
          config,
        });
      }
    },
    [sessionId, isConnected]
  );

  const startCombat = useCallback(() => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit(ArenaSocketEvents.C2S_START_COMBAT, { sessionId });
    }
  }, [sessionId, isConnected]);

  const skipPrep = useCallback(() => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit(ArenaSocketEvents.C2S_SKIP_PREP, { sessionId });
    }
  }, [sessionId, isConnected]);

  const togglePause = useCallback(() => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit(ArenaSocketEvents.C2S_TOGGLE_PAUSE, { sessionId });
    }
  }, [sessionId, isConnected]);

  const submitTranscript = useCallback(
    (text: string, isFinal = false, estimatedWpm?: number) => {
      if (socketRef.current && isConnected) {
        socketRef.current.emit(ArenaSocketEvents.C2S_SUBMIT_TRANSCRIPT, {
          sessionId,
          text,
          isFinal,
          estimatedWpm,
        });
      }
    },
    [sessionId, isConnected]
  );

  const submitDefense = useCallback(
    (defenseText: string) => {
      if (socketRef.current && isConnected && defenseText.trim()) {
        socketRef.current.emit(ArenaSocketEvents.C2S_SUBMIT_DEFENSE, {
          sessionId,
          defenseText: defenseText.trim(),
        });
      }
    },
    [sessionId, isConnected]
  );

  const requestNextQuestion = useCallback(() => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit(ArenaSocketEvents.C2S_REQUEST_NEXT_QUESTION, {
        sessionId,
      });
    }
  }, [sessionId, isConnected]);

  const dismissCoachingAlert = useCallback(() => {
    setCoachingAlert(null);
  }, []);

  return {
    isConnected,
    sessionState,
    timerData,
    liveTranscript,
    streamingQuestion,
    timeFreezeInfo,
    coachingAlert,
    lastVerdict,
    connectionError,
    updateConfig,
    startCombat,
    skipPrep,
    togglePause,
    submitTranscript,
    submitDefense,
    requestNextQuestion,
    dismissCoachingAlert,
  };
}
