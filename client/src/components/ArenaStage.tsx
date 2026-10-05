import React, { useState, useEffect } from 'react';
import {
  ArenaSessionState,
  JuryBossId,
  ArenaMode,
  SessionFsmState,
  S2CBossStreamChunkPayload,
  S2CTimeFreezePayload,
  S2CCoachingAlertPayload,
  S2CTimerTickPayload,
} from '@pitcharena/shared';
import { JudgeCard } from './JudgeCard';
import {
  ShieldAlert,
  Snowflake,
  Mic,
  Send,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  HelpCircle,
} from 'lucide-react';

interface ArenaStageProps {
  sessionState: ArenaSessionState | null;
  timerData: S2CTimerTickPayload | null;
  streamingQuestion: S2CBossStreamChunkPayload | null;
  timeFreezeInfo: S2CTimeFreezePayload;
  coachingAlert: S2CCoachingAlertPayload | null;
  isRecording: boolean;
  transcript: string;
  interimTranscript: string;
  onToggleRecord: () => void;
  onSubmitDefense: (defenseText: string) => void;
  onRequestNextQuestion: () => void;
  onTogglePause: () => void;
  onDismissCoachingAlert?: () => void;
}

export const ArenaStage: React.FC<ArenaStageProps> = ({
  sessionState,
  timerData,
  streamingQuestion,
  timeFreezeInfo,
  coachingAlert,
  isRecording,
  transcript,
  interimTranscript,
  onToggleRecord,
  onSubmitDefense,
  onRequestNextQuestion,
  onTogglePause,
}) => {
  const [manualDefenseText, setManualDefenseText] = useState('');

  // Tự động đồng bộ giọng nói vào ô nhập khi có kết quả
  useEffect(() => {
    if (transcript) {
      setManualDefenseText(transcript);
    }
  }, [transcript]);

  const activeBossId = sessionState?.activeBossId || JuryBossId.FINANCE_DRAGON;
  const mode = sessionState?.config.mode || ArenaMode.FULL_ARENA;
  const hp = sessionState?.candidateHp ?? 100;
  const isFrozen = timeFreezeInfo.isFrozen || sessionState?.isTimeFrozen;
  const isPaused = timerData?.isPaused || sessionState?.isPaused;
  const fsmState = timerData?.fsmState || sessionState?.fsmState;

  const turnRemaining =
    timerData?.turnRemainingSeconds ??
    sessionState?.turnRemainingSeconds ??
    30;

  // Thanh HP 20 khối pixel
  const totalBlocks = 20;
  const filledBlocks = Math.round((hp / 100) * totalBlocks);

  const handleDefenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = manualDefenseText.trim() || interimTranscript.trim();
    if (text) {
      onSubmitDefense(text);
      setManualDefenseText('');
    }
  };

  return (
    <div className="flex flex-col gap-5 w-full">
      {/* 1. HỘI ĐỒNG GIÁM KHẢO (3 Ghế Thẩm Định) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <JudgeCard
          bossId={JuryBossId.FINANCE_DRAGON}
          isActive={activeBossId === JuryBossId.FINANCE_DRAGON}
          isDimmed={
            mode === ArenaMode.QUICK_COMBAT &&
            activeBossId !== JuryBossId.FINANCE_DRAGON
          }
          isSpeaking={
            activeBossId === JuryBossId.FINANCE_DRAGON &&
            fsmState === SessionFsmState.BOSS_QUESTIONING
          }
        />
        <JudgeCard
          bossId={JuryBossId.TECH_SENTINEL}
          isActive={activeBossId === JuryBossId.TECH_SENTINEL}
          isDimmed={
            mode === ArenaMode.QUICK_COMBAT &&
            activeBossId !== JuryBossId.TECH_SENTINEL
          }
          isSpeaking={
            activeBossId === JuryBossId.TECH_SENTINEL &&
            fsmState === SessionFsmState.BOSS_QUESTIONING
          }
        />
        <JudgeCard
          bossId={JuryBossId.MARKET_SHARK}
          isActive={activeBossId === JuryBossId.MARKET_SHARK}
          isDimmed={
            mode === ArenaMode.QUICK_COMBAT &&
            activeBossId !== JuryBossId.MARKET_SHARK
          }
          isSpeaking={
            activeBossId === JuryBossId.MARKET_SHARK &&
            fsmState === SessionFsmState.BOSS_QUESTIONING
          }
        />
      </div>

      {/* 2. KHUNG ĐẤU TRƯỜNG CHÍNH (Arena Viewport) */}
      <div className="relative border-2 border-black bg-neutral-900 text-white p-5 shadow-[6px_6px_0px_#000] flex flex-col gap-4 overflow-hidden font-mono">
        {/* CRT Scanline Retro Effect */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.35)_50%)] bg-[length:100%_4px] pointer-events-none opacity-30 z-0" />

        {/* Header Sàn Đấu */}
        <div className="relative z-10 flex flex-wrap items-center justify-between pb-3 border-b border-neutral-700 gap-3">
          <div className="flex items-center gap-2">
            <span className="bg-rose-600 text-white font-bold text-xs px-2 py-0.5 border border-rose-400">
              LƯỢT {sessionState?.currentTurn ?? 1} / {sessionState?.totalTurns ?? 3}
            </span>
            <span className="text-xs text-neutral-300">
              CHỦ ĐỀ: <span className="text-amber-400 font-bold">{sessionState?.currentTopic || 'Unit Economics & Rủi ro cạn vốn'}</span>
            </span>
          </div>

          {/* Đồng hồ áp lực kèm hiệu ứng Time Freeze */}
          <div className="flex items-center gap-3">
            {isFrozen ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-cyan-950 border border-cyan-400 text-cyan-300 text-xs font-bold animate-pulse">
                <Snowflake className="w-3.5 h-3.5 animate-spin" />
                <span>TIME FREEZE (ĐÓNG BĂNG ĐỒNG HỒ)</span>
              </div>
            ) : isPaused ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-950 border border-amber-400 text-amber-300 text-xs font-bold">
                <Pause className="w-3.5 h-3.5" />
                <span>TẠM DỪNG CHIẾN THUẬT</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm bg-neutral-950 px-3 py-1 border border-neutral-700">
                <span>THỜI GIAN ĐỐI CHẤT:</span>
                <span className="text-lg text-rose-500 font-extrabold tracking-wider">
                  00:{turnRemaining.toString().padStart(2, '0')}
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={onTogglePause}
              className="p-1.5 bg-neutral-800 border border-neutral-600 hover:bg-neutral-700 text-neutral-200"
              title="Tạm dừng / Tiếp tục"
            >
              {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Thanh Máu Thí Sinh (20 Pixel Blocks) */}
        <div className="relative z-10 flex flex-col gap-1.5 bg-neutral-950/80 p-3 border border-neutral-800">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-bold text-neutral-300">
              <ShieldAlert className="w-3.5 h-3.5 text-emerald-400" />
              <span>THANH MÁU THÍ SINH (RESILIENCE): {hp}%</span>
            </span>
            <span className="text-[10px] text-emerald-400 font-bold">
              [SÀN BẢO VỆ TÂN THỦ: 20% HP]
            </span>
          </div>

          {/* 20 Block Bar */}
          <div className="flex items-center gap-1 w-full h-4 bg-neutral-900 border border-neutral-700 p-0.5">
            {Array.from({ length: totalBlocks }).map((_, i) => {
              const isFilled = i < filledBlocks;
              const isDangerZone = i < 4; // 20% đầu là sàn tân thủ
              let colorClass = 'bg-neutral-800';
              if (isFilled) {
                if (isDangerZone) colorClass = 'bg-rose-500';
                else if (i < 10) colorClass = 'bg-amber-400';
                else colorClass = 'bg-emerald-400';
              }
              return (
                <div
                  key={i}
                  className={`h-full flex-1 transition-all duration-150 ${colorClass}`}
                />
              );
            })}
          </div>
        </div>

        {/* Coaching Pivot Alert Banner (Strike 2) */}
        {coachingAlert && (
          <div className="relative z-10 bg-amber-950/90 border-2 border-amber-500 p-3.5 flex items-start gap-3 animate-fadeIn">
            <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 animate-bounce" />
            <div className="flex flex-col gap-1 text-xs">
              <div className="flex items-center gap-2">
                <span className="bg-amber-400 text-black font-bold px-1.5 py-0.2">
                  STRIKE 2 // COACHING PIVOT
                </span>
                <span className="text-amber-300 font-bold">
                  Hội đồng chuyển hướng sư phạm hỗ trợ
                </span>
              </div>
              <p className="text-neutral-200 leading-relaxed">
                {coachingAlert.message}
              </p>
            </div>
          </div>
        )}

        {/* Khung Câu Hỏi Giám Khảo (Boss Dialogue Stream) */}
        <div className="relative z-10 bg-black/90 border border-neutral-700 p-4 flex flex-col gap-2 min-h-[110px]">
          <div className="flex items-center justify-between text-xs text-neutral-400 border-b border-neutral-800 pb-1.5">
            <span className="text-amber-400 font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              LỜI CHẤT VẤN TỪ GIÁM KHẢO:
            </span>
            {streamingQuestion?.isCoachingPivot && (
              <span className="text-emerald-400 font-bold text-[10px]">
                [GỢI MỞ HƯỚNG DẪN XÂY DỰNG]
              </span>
            )}
          </div>

          <div className="text-sm text-neutral-100 leading-relaxed font-sans mt-1">
            {streamingQuestion?.accumulatedText ? (
              <span>
                "{streamingQuestion.accumulatedText}"
                {!streamingQuestion.isComplete && (
                  <span className="inline-block w-2 h-4 bg-amber-400 ml-1 animate-pulse" />
                )}
              </span>
            ) : (
              <span className="text-neutral-500 italic flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-neutral-500 animate-spin" />
                <span>Giám khảo đang xem xét hồ sơ và chuẩn bị đưa ra câu hỏi...</span>
              </span>
            )}
          </div>
        </div>

        {/* Khung Thí Sinh Phản Biện & Thu Âm */}
        <form onSubmit={handleDefenseSubmit} className="relative z-10 flex flex-col gap-2.5">
          <div className="flex items-center justify-between text-xs text-neutral-300">
            <span className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isRecording ? 'bg-rose-500 animate-ping' : 'bg-neutral-600'}`} />
              <span className="font-bold">LỜI PHẢN BIỆN CỦA THÍ SINH:</span>
            </span>

            <button
              type="button"
              onClick={onToggleRecord}
              className={`px-3 py-1 text-xs font-bold border flex items-center gap-1.5 transition-all ${
                isRecording
                  ? 'bg-rose-600 border-rose-400 text-white animate-pulse'
                  : 'bg-neutral-800 border-neutral-600 text-neutral-200 hover:bg-neutral-700'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>{isRecording ? 'DỪNG THU ÂM' : 'BẬT MIC NÓI'}</span>
            </button>
          </div>

          {/* Ô nhập hoặc hiển thị transcript */}
          <div className="relative">
            <textarea
              rows={3}
              value={manualDefenseText}
              onChange={(e) => setManualDefenseText(e.target.value)}
              placeholder="Nói vào micro hoặc gõ luận điểm phản biện trực tiếp vào đây..."
              className="w-full bg-neutral-950 border border-neutral-700 p-3 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400 resize-none font-sans"
            />
            {interimTranscript && (
              <div className="text-[11px] text-amber-300 italic px-3 pb-2 bg-neutral-950 border-x border-b border-neutral-700">
                Đang nhận diện giọng nói: {interimTranscript}...
              </div>
            )}
          </div>

          {/* Thanh Nút Hành Động */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={onRequestNextQuestion}
              className="px-3 py-2 bg-neutral-800 border border-neutral-600 text-neutral-300 hover:bg-neutral-700 text-xs font-bold flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>ĐỔI CÂU HỎI MỚI</span>
            </button>

            <button
              type="submit"
              disabled={!manualDefenseText.trim() && !interimTranscript.trim()}
              className="px-5 py-2 bg-amber-400 text-black border-2 border-black font-bold text-xs hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shadow-[2px_2px_0px_#fff]"
            >
              <span>NỘP BÀI PHẢN BIỆN (SUBMIT)</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
