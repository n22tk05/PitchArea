import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArenaSessionState,
  JuryBossId,
  ArenaMode,
  SessionFsmState,
  S2CBossStreamChunkPayload,
  S2CTimeFreezePayload,
  S2CCoachingAlertPayload,
  S2CTimerTickPayload,
  VerdictResult,
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
  Scale,
  ShieldCheck,
  AlertTriangle,
  Flame,
  History,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ArenaStageProps {
  sessionState: ArenaSessionState | null;
  timerData: S2CTimerTickPayload | null;
  streamingQuestion: S2CBossStreamChunkPayload | null;
  timeFreezeInfo: S2CTimeFreezePayload;
  coachingAlert: S2CCoachingAlertPayload | null;
  lastVerdict?: VerdictResult | null;
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
  lastVerdict,
  isRecording,
  transcript,
  interimTranscript,
  onToggleRecord,
  onSubmitDefense,
  onRequestNextQuestion,
  onTogglePause,
}) => {
  const [manualDefenseText, setManualDefenseText] = useState('');

  // Theo dõi biến động HP để nhấp nháy background màu nền thông báo
  const [hpFlashType, setHpFlashType] = useState<'damage' | 'heal' | null>(null);
  const [hpDelta, setHpDelta] = useState<number>(0);
  const prevHpRef = useRef<number | null>(null);

  // Tự động đồng bộ giọng nói vào ô nhập khi có kết quả
  useEffect(() => {
    if (transcript) {
      setManualDefenseText(transcript);
    }
  }, [transcript]);

  const activeBossId = sessionState?.activeBossId || JuryBossId.FINANCE_DRAGON;
  const mode = sessionState?.config.mode || ArenaMode.FULL_ARENA;
  const hp = sessionState?.candidateHp ?? 100;

  // Lắng nghe biến động HP để nháy nền
  useEffect(() => {
    if (prevHpRef.current !== null && prevHpRef.current !== hp) {
      const diff = hp - prevHpRef.current;
      setHpDelta(Math.abs(diff));
      if (diff < 0) {
        setHpFlashType('damage');
      } else if (diff > 0) {
        setHpFlashType('heal');
      }

      const timer = setTimeout(() => {
        setHpFlashType(null);
      }, 900);

      return () => clearTimeout(timer);
    }
    prevHpRef.current = hp;
  }, [hp]);
  const isFrozen = timeFreezeInfo.isFrozen || sessionState?.isTimeFrozen;
  const isPaused = timerData?.isPaused || sessionState?.isPaused;
  const fsmState = timerData?.fsmState || sessionState?.fsmState;

  // Lọc chỉ những Giám khảo có khối đề mục tồn tại trong tài liệu
  const availableBosses = useMemo(() => {
    if (sessionState?.availableBossIds && sessionState.availableBossIds.length > 0) {
      return sessionState.availableBossIds;
    }
    return [
      JuryBossId.MARKET_SHARK,
      JuryBossId.TECH_SENTINEL,
      JuryBossId.FINANCE_DRAGON,
      JuryBossId.RISK_STRATEGIST,
    ];
  }, [sessionState?.availableBossIds]);

  const gridColsClass =
    availableBosses.length === 1
      ? 'grid-cols-1 max-w-md mx-auto'
      : availableBosses.length === 2
      ? 'grid-cols-1 md:grid-cols-2'
      : availableBosses.length === 3
      ? 'grid-cols-1 md:grid-cols-3'
      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';

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
      {/* 1. HỘI ĐỒNG GIÁM KHẢO (Chỉ xuất hiện Giám khảo có khối đề mục tồn tại trong tài liệu) */}
      <div className={`grid ${gridColsClass} gap-3 w-full`}>
        {availableBosses.map((bossId) => (
          <JudgeCard
            key={bossId}
            bossId={bossId}
            isActive={activeBossId === bossId}
            isDimmed={
              mode === ArenaMode.QUICK_COMBAT &&
              activeBossId !== bossId
            }
            isSpeaking={
              activeBossId === bossId &&
              fsmState === SessionFsmState.BOSS_QUESTIONING
            }
          />
        ))}
      </div>

      {/* 2. KHUNG ĐẤU TRƯỜNG CHÍNH (Arena Viewport) */}
      <div
        className={`relative border-2 text-white p-5 shadow-[6px_6px_0px_#000] flex flex-col gap-4 overflow-hidden font-mono transition-all duration-300 ${
          hpFlashType === 'damage'
            ? 'border-rose-500 bg-rose-950/70 shadow-[0_0_35px_rgba(225,29,72,0.7)]'
            : hpFlashType === 'heal'
            ? 'border-emerald-400 bg-emerald-950/70 shadow-[0_0_35px_rgba(16,185,129,0.7)]'
            : 'border-black bg-neutral-900'
        }`}
      >
        {/* HP Change Flash Overlay Background */}
        {hpFlashType === 'damage' && (
          <div className="absolute inset-0 pointer-events-none z-0 animate-hp-damage" />
        )}
        {hpFlashType === 'heal' && (
          <div className="absolute inset-0 pointer-events-none z-0 animate-hp-heal" />
        )}

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
              <span>THANH MÁU THÍ SINH: {hp}%</span>
              {hpFlashType === 'damage' && (
                <span className="ml-2 px-1.5 py-0.5 bg-rose-600 text-white font-extrabold text-[10px] animate-bounce border border-rose-400 shadow-[2px_2px_0px_#000]">
                  🔻 -{hpDelta} HP (BỊ TRỪ MÁU)
                </span>
              )}
              {hpFlashType === 'heal' && (
                <span className="ml-2 px-1.5 py-0.5 bg-emerald-500 text-black font-extrabold text-[10px] animate-bounce border border-emerald-300 shadow-[2px_2px_0px_#000]">
                  🟢 +{hpDelta} HP (HỒI MÁU)
                </span>
              )}
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
              GIÁM KHẢO:
            </span>
          
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
              <span className="font-bold">THÍ SINH:</span>
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
          <div className="flex items-center justify-end pt-1">
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
