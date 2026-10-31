import React, { useEffect, useMemo, useRef } from 'react';
import {
  DocumentAnalysisResult,
  LobbyConfig as LobbyConfigType,
  SessionFsmState,
  ArenaSessionState,
} from '@pitcharena/shared';
import { ArrowLeft, ArrowRight, Sparkles, AlertTriangle } from 'lucide-react';
import { ArenaStage } from '../../components/ArenaStage';
import { useArenaSocket } from '../../hooks/useArenaSocket';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';

interface Step4CombatProps {
  documentData: DocumentAnalysisResult | null;
  lobbyConfig?: LobbyConfigType | null;
  pitchTranscript?: string;
  onBack: () => void;
  onNext: (finalSession?: ArenaSessionState | null) => void;
  arenaSocket?: ReturnType<typeof useArenaSocket>;
}

export const Step4Combat: React.FC<Step4CombatProps> = ({
  documentData,
  lobbyConfig,
  pitchTranscript,
  onBack,
  onNext,
  arenaSocket,
}) => {
  // Tạo sessionId cố định theo document hoặc ngẫu nhiên
  const sessionId = useMemo(() => {
    return documentData?.documentId ? `session-${documentData.documentId}` : 'arena-session-default';
  }, [documentData?.documentId]);

  // Hook kết nối WebSocket Sàn Đấu
  const defaultSocket = useArenaSocket(sessionId, documentData?.documentId);
  const activeSocket = arenaSocket || defaultSocket;

  const {
    isConnected,
    sessionState,
    timerData,
    streamingQuestion,
    timeFreezeInfo,
    coachingAlert,
    lastVerdict,
    connectionError,
    startCombat,
    skipPrep,
    togglePause,
    submitTranscript,
    submitDefense,
    requestNextQuestion,
    dismissCoachingAlert,
    updateConfig,
    finishCombat,
  } = activeSocket;

  const {
    isRecording,
    transcript,
    interimTranscript,
    speechError,
    startRecording,
    stopRecording,
    resetTranscript,
  } = useAudioRecorder();

  // Khi chuyển lượt mới: Xóa sạch transcript của câu hỏi trước
  useEffect(() => {
    resetTranscript();
  }, [sessionState?.currentTurn, resetTranscript]);

  const hasCombatStartedRef = useRef<boolean>(false);

  // Khi vào Step 4: Cập nhật cấu hình và bắt đầu trận đấu
  useEffect(() => {
    if (isConnected && lobbyConfig) {
      updateConfig(lobbyConfig);
    }
  }, [isConnected, lobbyConfig, updateConfig]);

  useEffect(() => {
    if (isConnected) {
      if (
        sessionState?.fsmState === SessionFsmState.LOBBY_READY ||
        (!hasCombatStartedRef.current && sessionState?.fsmState === SessionFsmState.EVALUATION_REPORT)
      ) {
        startCombat();
      }
    }
  }, [isConnected, sessionState?.fsmState, startCombat]);

  useEffect(() => {
    if (
      sessionState?.fsmState === SessionFsmState.PREP_BUFFER ||
      sessionState?.fsmState === SessionFsmState.COMBAT_ACTIVE
    ) {
      hasCombatStartedRef.current = true;
    }
  }, [sessionState?.fsmState]);

  // TỰ ĐỘNG BẬT MICRO
  const isCombatActiveAndUnfrozen =
    (timerData?.fsmState ?? sessionState?.fsmState) === SessionFsmState.COMBAT_ACTIVE &&
    !(timeFreezeInfo?.isFrozen || sessionState?.isTimeFrozen) &&
    !(timerData?.isPaused || sessionState?.isPaused);

  const prevActiveRef = useRef<boolean>(false);

  useEffect(() => {
    if (isCombatActiveAndUnfrozen && !prevActiveRef.current) {
      startRecording();
    }
    prevActiveRef.current = isCombatActiveAndUnfrozen;
  }, [isCombatActiveAndUnfrozen, startRecording]);

  // Gửi transcript tạm thời lên server
  useEffect(() => {
    if (interimTranscript) {
      submitTranscript(interimTranscript, false);
    }
  }, [interimTranscript, submitTranscript]);

  // KHI HẾT GIỜ (turnRemainingSeconds === 0)
  useEffect(() => {
    const remaining = timerData?.turnRemainingSeconds ?? sessionState?.turnRemainingSeconds;
    const currentState = timerData?.fsmState ?? sessionState?.fsmState;

    if (currentState === SessionFsmState.COMBAT_ACTIVE && remaining === 0) {
      if (isRecording) {
        stopRecording();
      }
      resetTranscript();
    }
  }, [
    timerData?.turnRemainingSeconds,
    sessionState?.turnRemainingSeconds,
    timerData?.fsmState,
    sessionState?.fsmState,
    isRecording,
    stopRecording,
    resetTranscript,
  ]);

  const handleToggleRecord = () => {
    if (isRecording) {
      stopRecording();
      if (transcript) {
        submitTranscript(transcript, true);
      }
    } else {
      startRecording();
    }
  };

  const handleDefenseSubmit = (text: string) => {
    submitDefense(text);
    if (isRecording) {
      stopRecording();
    }
    resetTranscript();
  };

  // Tự động chuyển sang Báo cáo khi trận đấu kết thúc (FSM EVALUATION_REPORT)
  useEffect(() => {
    if (hasCombatStartedRef.current && sessionState?.fsmState === SessionFsmState.EVALUATION_REPORT) {
      if (isRecording) {
        stopRecording();
      }
      onNext(sessionState);
    }
  }, [sessionState?.fsmState, sessionState, isRecording, stopRecording, onNext]);

  const handleEndCombat = () => {
    hasCombatStartedRef.current = true;
    if (isRecording) {
      stopRecording();
    }
    finishCombat();
    setTimeout(() => {
      onNext(sessionState);
    }, 1500);
  };

  // Xác định sự hiện diện của Khối 6 và cờ Bẻ lái Đề án (Major Pivot)
  const hasSection6 = useMemo(() => {
    if (sessionState?.hasSection6) return true;
    return Boolean(
      documentData?.sections?.some(
        (sec) =>
          (sec.type as string) === 'DYNAMIC_EXPANDED_SCOPE' ||
          (sec.type as string) === 'PITCH_EXPANSION_SEC6'
      )
    );
  }, [sessionState?.hasSection6, documentData?.sections]);

  const isPivotDetected = Boolean(sessionState?.isPivotDetected);

  return (
    <div className="flex flex-col gap-6 animate-fadeIn pb-8">
      {/* Thanh Trạng Thái Đỉnh Sàn Đấu */}
      <div className="border-2 border-black bg-white rounded-2xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="bg-[#FEF3C7] text-[#92400E] font-pixel text-xs font-bold px-3 py-1.5 flex items-center gap-2 border border-[#F59E0B]/50 rounded-full shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            BƯỚC 04 // PHẢN BIỆN (COMBAT ARENA)
          </span>

          {hasSection6 && (
            <span
              data-testid="section6-combat-badge"
              className="bg-[#FEF3C7] text-[#92400E] font-pixel text-xs font-bold px-3 py-1.5 flex items-center gap-1.5 border border-[#F59E0B]/50 rounded-full shadow-xs animate-pulse"
            >
              <Sparkles className="w-3.5 h-3.5" />
              [KHỐI 6: Ý TƯỞNG MỞ RỘNG PHÁT SINH]
            </span>
          )}

          {isPivotDetected && (
            <span
              data-testid="major-pivot-combat-badge"
              className="bg-rose-100 text-rose-800 font-pixel text-xs font-bold px-3 py-1.5 flex items-center gap-1.5 border border-rose-300 rounded-full shadow-xs animate-bounce"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              [CỜ BẺ LÁI ĐỀ ÁN: MAJOR PIVOT]
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {sessionState?.fsmState === SessionFsmState.PREP_BUFFER && (
            <button
              type="button"
              onClick={skipPrep}
              className="px-3.5 py-2 bg-[#FEF3C7] text-[#92400E] border border-[#F59E0B]/60 font-pixel text-xs font-bold hover:bg-[#FDE68A] animate-pulse rounded-xl cursor-pointer shadow-xs"
            >
              VUI LÒNG CHỜ
            </button>
          )}

          <button
            type="button"
            onClick={handleEndCombat}
            className="px-5 py-2.5 bg-[#B45309] hover:bg-[#92400E] text-white font-headline text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs rounded-xl transition-all"
          >
            <span>KẾT THÚC ĐỐI CHẤT →</span>
          </button>
        </div>
      </div>

      {connectionError && (
        <div className="p-3.5 bg-rose-50 border border-rose-300 text-rose-800 font-mono text-xs rounded-xl">
          Lưu ý kết nối: {connectionError}. Hệ thống đang hoạt động ở chế độ mô phỏng phản xạ nhanh tại chỗ.
        </div>
      )}

      {speechError && (
        <div className="p-3.5 bg-[#FAF8F5] border border-amber-300 text-amber-900 font-mono text-xs flex items-center justify-between rounded-xl">
          <span>⚠️ {speechError}</span>
          <span className="text-[10px] text-[#78716C]">Bạn vẫn có thể gõ trực tiếp luận điểm phản biện vào khung chat bên dưới.</span>
        </div>
      )}

      {/* Sàn Đấu Trực Quan ArenaStage */}
      <ArenaStage
        sessionState={sessionState}
        timerData={timerData}
        streamingQuestion={streamingQuestion}
        timeFreezeInfo={timeFreezeInfo}
        coachingAlert={coachingAlert}
        lastVerdict={lastVerdict}
        isRecording={isRecording}
        transcript={transcript}
        interimTranscript={interimTranscript}
        onToggleRecord={handleToggleRecord}
        onSubmitDefense={handleDefenseSubmit}
        onRequestNextQuestion={requestNextQuestion}
        onTogglePause={togglePause}
        onDismissCoachingAlert={dismissCoachingAlert}
        lobbyConfig={lobbyConfig}
      />

      {/* Thanh Điều Hướng Dưới Cùng */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2.5 border border-[#D97706]/35 rounded-xl bg-[#FFFFFF] text-[#1C1917] font-mono text-xs font-bold hover:bg-[#FEF3C7] hover:text-[#92400E] flex items-center gap-2 transition-all shadow-xs cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-[#D97706]" />
          <span>QUAY LẠI PITCHING (BƯỚC 03)</span>
        </button>

        <button
          type="button"
          onClick={handleEndCombat}
          className="px-5 py-2.5 bg-[#B45309] hover:bg-[#92400E] text-white font-headline font-bold text-xs flex items-center gap-2 cursor-pointer shadow-xs rounded-xl transition-all"
        >
          <span>XEM BÁO CÁO PHỤ LỤC (BƯỚC 05)</span>
          <ArrowRight className="w-4 h-4 text-white" />
        </button>
      </div>
    </div>
  );
};

export const Step3Combat = Step4Combat;
