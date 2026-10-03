import React, { useState, useCallback } from 'react';
import {
  CombatDifficulty,
  CombatDifficultyDetails,
  ArenaMode,
  JuryBossId,
  JURY_BOSS_PROFILES,
  LobbyConfig as LobbyConfigType,
  DocumentAnalysisResult,
  SessionFsmState,
} from '@pitcharena/shared';
import {
  Shield,
  Zap,
  Flame,
  Swords,
  Coins,
  Cpu,
  ShieldAlert,
  Sliders,
  Play,
  RotateCcw,
  Sparkles,
  Layers,
  Volume2,
} from 'lucide-react';
import { useArenaSocket } from '../hooks/useArenaSocket';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { AudioWaveform } from './AudioWaveform';
import { TimerDisplay } from './TimerDisplay';
import { fixMojibake } from './DocumentUploader';

interface LobbyConfigProps {
  documentData: DocumentAnalysisResult;
  onBackToUpload?: () => void;
}

export const LobbyConfig: React.FC<LobbyConfigProps> = ({
  documentData,
  onBackToUpload,
}) => {
  const sessionId = `session-${documentData.documentId}`;

  // Cấu hình ban đầu
  const [config, setConfig] = useState<LobbyConfigType>({
    mode: ArenaMode.FULL_ARENA,
    difficulty: CombatDifficulty.NORMAL,
    selectedBoss: JuryBossId.FINANCE_DRAGON,
    roundDurationSeconds: 30,
    prepBufferSeconds: 7,
    enableLiveSubtitles: true,
    pedagogicalShieldFloor: 20,
  });

  // WebSocket Hook
  const {
    isConnected,
    sessionState,
    timerData,
    liveTranscript,
    updateConfig,
    startCombat,
    skipPrep,
    togglePause,
    submitTranscript,
  } = useArenaSocket(sessionId, documentData.documentId);

  // Audio Recorder Transcript Callback
  const handleTranscriptChange = useCallback(
    (text: string, isFinal: boolean, wpm?: number) => {
      submitTranscript(text, isFinal, wpm);
    },
    [submitTranscript]
  );

  // Audio Recorder Hook với VAD gap tương ứng cấp độ khó đã chọn
  const {
    isRecording,
    audioLevel,
    transcript,
    interimTranscript,
    estimatedWpm,
    isSilent,
    startRecording,
    stopRecording,
  } = useAudioRecorder({
    vadThresholdSec: CombatDifficultyDetails[config.difficulty].vadSilenceSec,
    onTranscriptChange: handleTranscriptChange,
  });

  const handleModeChange = (mode: ArenaMode) => {
    if (isCombatStarted) return;
    const updated = { ...config, mode };
    setConfig(updated);
    updateConfig(updated);
  };

  const handleDifficultyChange = (difficulty: CombatDifficulty) => {
    if (isCombatStarted) return;
    const updated = { ...config, difficulty };
    setConfig(updated);
    updateConfig(updated);
  };

  const handleBossSelect = (bossId: JuryBossId) => {
    if (isCombatStarted) return;
    const updated = { ...config, selectedBoss: bossId, mode: ArenaMode.QUICK_COMBAT };
    setConfig(updated);
    updateConfig(updated);
  };

  const handleToggleSubtitles = () => {
    const updated = {
      ...config,
      enableLiveSubtitles: !config.enableLiveSubtitles,
    };
    setConfig(updated);
    updateConfig(updated);
  };

  const fsmState = timerData?.fsmState || sessionState?.fsmState || SessionFsmState.LOBBY_READY;
  const isCombatStarted = fsmState !== SessionFsmState.LOBBY_READY;

  return (
    <div className="w-full flex flex-col gap-6 font-mono text-black">
      {/* Top Session Bar */}
      <div className="border-2 border-black bg-white p-3 shadow-[4px_4px_0px_#000] flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold bg-black text-white px-2 py-0.5">
            BƯỚC 02 // SẢNH ĐẤU & VOICE FLOW
          </span>
          <span className="text-neutral-600">
            TÀI LIỆU: <strong className="text-black">{fixMojibake(documentData.filename)}</strong>
          </span>
          <span className="text-neutral-500">
            ({documentData.sections.length} PHÂN MỤC • {documentData.blindSpots.length} ĐIỂM MÙ)
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isConnected ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'
              }`}
            />
            <span className="text-[11px] font-bold">
              {isConnected ? 'SOCKET ONLINE' : 'DISCONNECTED'}
            </span>
          </div>

          {onBackToUpload && (
            <button
              onClick={onBackToUpload}
              className="px-2 py-1 border border-black hover:bg-neutral-100 flex items-center gap-1 text-[11px]"
            >
              <RotateCcw className="w-3 h-3" />
              NẠP LẠI TÀI LIỆU
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Cấu hình Trận đấu & Hội đồng Boss */}
        <div className="lg:col-span-7 flex flex-col gap-5">
          {/* 1. Chế độ đấu: Full Arena / Quick Combat */}
          <div className="border-2 border-black bg-white p-4 shadow-[4px_4px_0px_#000]">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-black/20">
              <Swords className="w-4 h-4 text-black" />
              <h3 className="font-bold text-sm">1. CHẾ ĐỘ THI ĐẤU (ARENA MODE)</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleModeChange(ArenaMode.FULL_ARENA)}
                className={`p-3 border-2 text-left transition-all flex flex-col gap-1.5 ${
                  config.mode === ArenaMode.FULL_ARENA
                    ? 'border-black bg-neutral-100 shadow-[3px_3px_0px_#000]'
                    : 'border-neutral-300 bg-white hover:border-black'
                }`}
              >
                <div className="flex items-center justify-between font-bold text-xs">
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" />
                    HỘI ĐỒNG TOÀN DIỆN
                  </span>
                  {config.mode === ArenaMode.FULL_ARENA && (
                    <span className="bg-black text-white text-[10px] px-1.5 py-0.2">ACTIVE</span>
                  )}
                </div>
                <p className="text-[11px] text-neutral-600 leading-relaxed font-sans">
                  3 Giám khảo AI luân phiên phản biện theo 5 phân mục tài liệu đã nạp.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleModeChange(ArenaMode.QUICK_COMBAT)}
                className={`p-3 border-2 text-left transition-all flex flex-col gap-1.5 ${
                  config.mode === ArenaMode.QUICK_COMBAT
                    ? 'border-black bg-neutral-100 shadow-[3px_3px_0px_#000]'
                    : 'border-neutral-300 bg-white hover:border-black'
                }`}
              >
                <div className="flex items-center justify-between font-bold text-xs">
                  <span className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    SOLO BOSS COMBAT
                  </span>
                  {config.mode === ArenaMode.QUICK_COMBAT && (
                    <span className="bg-black text-white text-[10px] px-1.5 py-0.2">ACTIVE</span>
                  )}
                </div>
                <p className="text-[11px] text-neutral-600 leading-relaxed font-sans">
                  Chọn 1 Giám khảo đối chất 1-on-1 (2 Giám khảo còn lại mờ 25% Opacity).
                </p>
              </button>
            </div>
          </div>

          {/* 2. Cấp độ khó (Difficulty) */}
          <div className="border-2 border-black bg-white p-4 shadow-[4px_4px_0px_#000]">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-black/20">
              <Sliders className="w-4 h-4 text-black" />
              <h3 className="font-bold text-sm">2. CẤP ĐỘ KHÓ (DIFFICULTY LEVEL)</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {Object.values(CombatDifficulty).map((diff) => {
                const details = CombatDifficultyDetails[diff];
                const isSelected = config.difficulty === diff;

                return (
                  <button
                    key={diff}
                    type="button"
                    onClick={() => handleDifficultyChange(diff)}
                    className={`p-2.5 border-2 text-left transition-all flex flex-col gap-1 ${
                      isSelected
                        ? 'border-black bg-neutral-100 shadow-[3px_3px_0px_#000]'
                        : 'border-neutral-300 bg-white hover:border-black'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-xs">
                      <span>{details.label}</span>
                      <span className={`text-[10px] px-1 border ${details.badgeColor}`}>
                        -{details.hpPenalty}% HP
                      </span>
                    </div>
                    <p className="text-[10px] text-neutral-600 leading-snug font-sans">
                      {details.desc}
                    </p>
                    <div className="text-[10px] text-neutral-500 font-mono mt-1">
                      VAD Gap: {details.vadSilenceSec}s
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Hội Đồng Giám Khảo & Hiệu Ứng Dimmed Silhouette Opacity 25% */}
          <div className="border-2 border-black bg-white p-4 shadow-[4px_4px_0px_#000]">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-black/20">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-black" />
                <h3 className="font-bold text-sm">3. THÀNH PHẦN HỘI ĐỒNG GIÁM KHẢO</h3>
              </div>
              <span className="text-[11px] text-neutral-500">
                {config.mode === ArenaMode.QUICK_COMBAT
                  ? 'Bấm để chọn Solo Boss (2 Boss còn lại mờ 25%)'
                  : 'Đầy đủ 3 Giám khảo phản biện'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {Object.values(JURY_BOSS_PROFILES).map((boss) => {
                const isSoloSelected =
                  config.mode === ArenaMode.QUICK_COMBAT && config.selectedBoss === boss.id;
                const isDimmed =
                  config.mode === ArenaMode.QUICK_COMBAT && config.selectedBoss !== boss.id;

                const IconComponent =
                  boss.id === JuryBossId.FINANCE_DRAGON
                    ? Coins
                    : boss.id === JuryBossId.TECH_SENTINEL
                    ? Cpu
                    : ShieldAlert;

                return (
                  <div
                    key={boss.id}
                    onClick={() => handleBossSelect(boss.id)}
                    className={`border-2 p-3 transition-all duration-300 cursor-pointer flex flex-col gap-2 relative ${
                      isDimmed
                        ? 'opacity-25 border-dashed border-neutral-400 bg-neutral-100 filter grayscale pointer-events-auto'
                        : isSoloSelected
                        ? 'border-black bg-neutral-50 shadow-[4px_4px_0px_#000] ring-2 ring-amber-400'
                        : 'border-black bg-white shadow-[2px_2px_0px_#000] hover:shadow-[4px_4px_0px_#000]'
                    }`}
                  >
                    {isSoloSelected && (
                      <span className="absolute -top-2.5 right-2 bg-amber-400 text-black border border-black text-[9px] font-bold px-1.5 py-0.2">
                        TARGET BOSS
                      </span>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="p-1.5 border border-black bg-black text-white">
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] font-bold border border-black px-1">
                        LV.{boss.level}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-bold text-xs">{boss.name}</h4>
                      <p className="text-[10px] text-neutral-600 font-sans">{boss.title}</p>
                    </div>

                    <div className="text-[10px] text-neutral-800 bg-neutral-100 p-1.5 border border-black/10 font-sans leading-tight">
                      <strong>Trọng tâm:</strong> {boss.focus}
                    </div>

                    {isDimmed && (
                      <div className="text-[9px] text-center font-bold text-neutral-500 uppercase tracking-widest pt-1">
                        [ DIMMED SILHOUETTE ]
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Voice Testing, Audio Waveform & Timer Controls */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          {/* Live Waveform & Mic Testing */}
          <div className="border-2 border-black bg-white p-4 shadow-[4px_4px_0px_#000] flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-black/20">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-black" />
                <h3 className="font-bold text-sm">4. KIỂM THỬ MICRO & SÓNG ÂM</h3>
              </div>
              <button
                type="button"
                onClick={handleToggleSubtitles}
                className="text-[10px] font-bold underline cursor-pointer"
              >
                {config.enableLiveSubtitles ? 'PHỤ ĐỀ: BẬT' : 'PHỤ ĐỀ: TẮT'}
              </button>
            </div>

            <AudioWaveform
              isRecording={isRecording}
              audioLevel={audioLevel}
              estimatedWpm={estimatedWpm}
              isSilent={isSilent}
            />

            {/* Mic Toggle Button */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className={`flex-1 py-2 font-mono text-xs font-bold border-2 border-black transition-all ${
                  isRecording
                    ? 'bg-rose-500 text-white shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5'
                    : 'bg-emerald-400 text-black shadow-[2px_2px_0px_#000] hover:bg-emerald-300 active:translate-x-0.5 active:translate-y-0.5'
                }`}
              >
                {isRecording ? '■ DỪNG MICRO TEST' : '▶ BẬT MICRO TEST GIỌNG NÓI'}
              </button>
            </div>

            {/* Real-time Subtitle & Transcript Preview */}
            <div className="border border-black bg-neutral-900 text-emerald-400 p-2.5 font-mono text-[11px] min-h-[70px] flex flex-col justify-between">
              <div className="flex items-center justify-between text-[9px] text-neutral-400 border-b border-neutral-700 pb-1 mb-1">
                <span>LIVE TRANSCRIPT PREVIEW (220ms STREAM)</span>
                <span>{isRecording ? 'STREAMING...' : 'IDLE'}</span>
              </div>
              <p className="leading-relaxed">
                {transcript || interimTranscript || liveTranscript?.text || (
                  <span className="text-neutral-500 italic">
                    Bật micro và thử nói: "Xin chào hội đồng, giải pháp của chúng tôi giải quyết vấn đề quy mô thị trường..."
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Timer Display Component */}
          <TimerDisplay
            fsmState={fsmState}
            prepRemainingSeconds={
              timerData?.prepRemainingSeconds ?? sessionState?.prepRemainingSeconds ?? 7
            }
            turnRemainingSeconds={
              timerData?.turnRemainingSeconds ?? sessionState?.turnRemainingSeconds ?? 30
            }
            isPaused={sessionState?.isPaused ?? timerData?.isPaused ?? false}
            onSkipPrep={skipPrep}
            onTogglePause={togglePause}
          />

          {/* Action Button: Start Combat */}
          <div className="border-2 border-black bg-neutral-100 p-4 shadow-[4px_4px_0px_#000] flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold">SÀN BẢO VỆ TÂN THỦ:</span>
              <span className="font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 border border-emerald-300">
                KHÓA MÁU MIN {config.pedagogicalShieldFloor}% HP
              </span>
            </div>

            <button
              type="button"
              onClick={startCombat}
              className="w-full py-3.5 bg-black text-white font-mono font-bold text-sm border-2 border-black shadow-[4px_4px_0px_#eab308] hover:bg-neutral-800 active:translate-x-1 active:translate-y-1 active:shadow-none flex items-center justify-center gap-2 tracking-wide"
            >
              <Play className="w-4 h-4 fill-amber-400 text-amber-400" />
              {isCombatStarted
                ? '[ TÁI KHỞI ĐỘNG VÒNG ĐẤU ]'
                : '[ KHỞI ĐỘNG VÒNG ĐẤU PHẢN BIỆN ]'}
            </button>

            <p className="text-[10px] text-neutral-500 text-center font-sans">
              *Hệ thống sẽ kích hoạt 07s đệm suy nghĩ trước khi đồng hồ 30s đối chất đếm lùi.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
