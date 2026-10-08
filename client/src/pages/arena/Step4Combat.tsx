import React, { useEffect, useMemo } from 'react';
import {
  DocumentAnalysisResult,
  LobbyConfig as LobbyConfigType,
  SessionFsmState,
} from '@pitcharena/shared';
import { ArrowLeft, ArrowRight, ShieldCheck, Wifi, WifiOff } from 'lucide-react';
import { ArenaStage } from '../../components/ArenaStage';
import { useArenaSocket } from '../../hooks/useArenaSocket';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';

interface Step4CombatProps {
  documentData: DocumentAnalysisResult | null;
  lobbyConfig?: LobbyConfigType | null;
  pitchTranscript?: string;
  onBack: () => void;
  onNext: () => void;
}

export const Step4Combat: React.FC<Step4CombatProps> = ({
  documentData,
  lobbyConfig,
  pitchTranscript,
  onBack,
  onNext,
}) => {
  // Tạo sessionId cố định theo document hoặc ngẫu nhiên
  const sessionId = useMemo(() => {
    return documentData?.documentId ? `session-${documentData.documentId}` : 'arena-session-default';
  }, [documentData?.documentId]);

  // Hook kết nối WebSocket Sàn Đấu
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
  } = useArenaSocket(sessionId, documentData?.documentId);

  // Hook Audio Recorder cho Micro thí sinh
  const {
    isRecording,
    transcript,
    interimTranscript,
    startRecording,
    stopRecording,
  } = useAudioRecorder();

  // Khi vào Step 4: Cập nhật cấu hình và bắt đầu trận đấu nếu đang ở LOBBY
  useEffect(() => {
    if (isConnected && lobbyConfig) {
      updateConfig(lobbyConfig);
    }
  }, [isConnected, lobbyConfig, updateConfig]);

  useEffect(() => {
    if (isConnected && sessionState?.fsmState === SessionFsmState.LOBBY_READY) {
      startCombat();
    }
  }, [isConnected, sessionState?.fsmState, startCombat]);

  // Gửi transcript tạm thời lên server khi có phát biểu
  useEffect(() => {
    if (interimTranscript) {
      submitTranscript(interimTranscript, false);
    }
  }, [interimTranscript, submitTranscript]);

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
  };

  return (
    <div className="flex flex-col gap-6 animate-fadeIn pb-8">
      {/* Thanh Trạng Thái Đỉnh Sàn Đấu */}
      <div className="border-2 border-black bg-white p-4 shadow-[4px_4px_0px_#000] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="bg-rose-600 text-white font-mono text-xs font-bold px-2 py-0.5 flex items-center gap-1.5 border border-rose-800">
            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
            BƯỚC 04 // SÀN ĐẤU PHẢN BIỆN (COMBAT ARENA)
          </span>

        </div>

        <div className="flex items-center gap-3">
          {sessionState?.fsmState === SessionFsmState.PREP_BUFFER && (
            <button
              type="button"
              onClick={skipPrep}
              className="px-3 py-1 bg-amber-400 text-black border border-black font-mono text-xs font-bold hover:bg-amber-300 animate-pulse"
            >
              BỎ QUA 7S ĐỆM →
            </button>
          )}

          <button
            type="button"
            onClick={onNext}
            className="px-3.5 py-1 bg-black text-white font-mono text-xs font-bold hover:bg-neutral-800 flex items-center gap-1.5"
          >
            <span>KẾT THÚC ĐỐI CHẤT →</span>
          </button>
        </div>
      </div>

      {connectionError && (
        <div className="p-3 bg-rose-50 border-2 border-rose-500 text-rose-700 font-mono text-xs">
          Lưu ý kết nối: {connectionError}. Hệ thống đang hoạt động ở chế độ mô phỏng phản xạ nhanh tại chỗ.
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
      />

      {/* Thanh Điều Hướng Dưới Cùng */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 border-2 border-black font-mono text-xs font-bold hover:bg-neutral-100 flex items-center gap-1.5 active:translate-x-0.5 active:translate-y-0.5 shadow-[2px_2px_0px_#000]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>QUAY LẠI PITCHING (BƯỚC 03)</span>
        </button>

        <button
          type="button"
          onClick={onNext}
          className="px-5 py-2.5 bg-black text-white font-mono font-bold text-xs border-2 border-black shadow-[3px_3px_0px_#eab308] hover:bg-neutral-800 active:translate-x-0.5 active:translate-y-0.5 flex items-center gap-2"
        >
          <span>XEM BÁO CÁO PHỤ LỤC (BƯỚC 05)</span>
          <ArrowRight className="w-4 h-4 text-amber-400" />
        </button>
      </div>
    </div>
  );
};
export const Step3Combat = Step4Combat;
