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
  JURY_BOSS_PROFILES,
  LobbyConfig as LobbyConfigType,
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
  Clock,
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
  lobbyConfig?: LobbyConfigType | null;
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
  lobbyConfig,
}) => {
  const [manualDefenseText, setManualDefenseText] = useState('');

  // Cấu hình tổng quỹ thời gian Q&A (từ lobbyConfig hoặc sessionState)
  const configuredQaMinutes =
    lobbyConfig?.qaDurationMinutes ??
    sessionState?.config.qaDurationMinutes ??
    3;
  const [qaRemainingSeconds, setQaRemainingSeconds] = useState<number>(
    () => configuredQaMinutes * 60
  );

  useEffect(() => {
    setQaRemainingSeconds(configuredQaMinutes * 60);
  }, [configuredQaMinutes]);

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

  // Xóa sạch câu trả lời cũ của câu trước khi chuyển lượt hoặc Giám khảo đổi câu hỏi mới
  useEffect(() => {
    setManualDefenseText('');
  }, [sessionState?.currentTurn, sessionState?.activeQuestion]);

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

  // Kiểm tra phán quyết gần nhất để duy trì hiệu ứng xanh khi trả lời đúng
  const effectiveVerdict = lastVerdict || sessionState?.lastVerdict;
  const isAnswerCorrect = useMemo(() => {
    if (!effectiveVerdict) return false;
    // Điểm chất lượng tổng hợp Q >= 60 hoặc có điểm cộng máu / giữ máu không bị trừ
    return effectiveVerdict.score.overallScore >= 60 || effectiveVerdict.hpDelta >= 0;
  }, [effectiveVerdict]);

  // Thông tin chuỗi phản biện (Streak)
  const streakInfo = useMemo(() => {
    if (sessionState?.streak && sessionState.streak.count > 0) {
      return sessionState.streak;
    }
    if (effectiveVerdict?.streakCount !== undefined) {
      return {
        count: effectiveVerdict.streakCount,
        type: (effectiveVerdict.score.overallScore >= 60 ? 'WIN' : 'LOSE') as 'WIN' | 'LOSE' | 'NEUTRAL',
      };
    }
    return { count: 0, type: 'NEUTRAL' as const };
  }, [sessionState?.streak, effectiveVerdict]);

  const isFrozen = timeFreezeInfo.isFrozen || sessionState?.isTimeFrozen;
  const isPaused = timerData?.isPaused || sessionState?.isPaused;
  const fsmState = timerData?.fsmState || sessionState?.fsmState;

  // Đếm ngược Tổng thời gian Q&A theo giây: chỉ đếm khi đang trong lượt đối chất (COMBAT_ACTIVE)
  useEffect(() => {
    if (isPaused || isFrozen) return;
    if (fsmState !== SessionFsmState.COMBAT_ACTIVE) {
      return;
    }

    const interval = setInterval(() => {
      setQaRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPaused, isFrozen, fsmState]);

  const formatQaTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

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
      {/* 2. KHUNG ĐẤU TRƯỜNG CHÍNH (Arena Viewport) */}
      <div
        className={`relative border-2 text-white p-5 shadow-[6px_6px_0px_#000] flex flex-col gap-4 overflow-hidden font-mono transition-all duration-300 ${
          hpFlashType === 'damage'
            ? 'border-rose-500 bg-rose-950/70 shadow-[0_0_35px_rgba(225,29,72,0.7)]'
            : hpFlashType === 'heal'
            ? 'border-emerald-400 bg-emerald-950/70 shadow-[0_0_35px_rgba(16,185,129,0.7)]'
            : isAnswerCorrect
            ? 'border-emerald-500 bg-neutral-900 animate-correct-pulse'
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

        {/* Hiệu ứng viền phát sáng xanh báo hiệu câu trả lời đúng trọng tâm */}
        {isAnswerCorrect && !hpFlashType && (
          <div className="absolute inset-0 pointer-events-none z-0 bg-emerald-950/20 border-2 border-emerald-500/40" />
        )}

        {/* CRT Scanline Retro Effect */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.35)_50%)] bg-[length:100%_4px] pointer-events-none opacity-30 z-0" />

        {/* Header Sàn Đấu */}
        <div className="relative z-10 flex flex-wrap items-center justify-between pb-3 border-b border-neutral-700 gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-neutral-300">
              GIÁM KHẢO: <span className="text-amber-400 font-bold">{JURY_BOSS_PROFILES[activeBossId].name}</span>
            </span>

            {streakInfo.count >= 2 && (
              <span
                className={`px-2 py-0.5 text-black font-extrabold text-xs flex items-center gap-1 border shadow-[2px_2px_0px_#000] ${
                  streakInfo.type === 'WIN'
                    ? 'bg-amber-400 border-amber-300 animate-streak-fire'
                    : 'bg-rose-400 border-rose-300'
                }`}
              >
                <Flame className="w-3.5 h-3.5 text-rose-700" />
                <span>Streak {streakInfo.count}</span>
              </span>
            )}
          </div>

          {/* Cụm đồng hồ: Tổng quỹ Q&A đã set & Thời gian đối chất lượt này */}
          {/* Cụm đồng hồ: Tổng quỹ Q&A đã set & Thời gian đối chất lượt này (Đồng bộ chiều cao h-9) */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* 1. Tổng Quỹ Thời Gian Q&A đã cấu hình */}
            <div className="h-9 flex items-center gap-2 px-3 bg-neutral-950 border border-neutral-700 text-xs font-bold shadow-[2px_2px_0px_#000]">
              <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="text-neutral-400">Thời gian Q&A:</span>
              <span className="text-base text-amber-400 font-extrabold tracking-wider">
                {formatQaTime(qaRemainingSeconds)}
              </span>
              <span className="text-[10px] text-neutral-500 font-normal">
                / {configuredQaMinutes.toString().padStart(2, '0')}:00
              </span>
            </div>

            {/* 2. Đồng hồ đối chất lượt (30s) kèm hiệu ứng Time Freeze */}
            {isFrozen ? (
              <div className="h-9 flex items-center gap-1.5 px-3 bg-cyan-950 border border-cyan-400 text-cyan-300 text-xs font-bold animate-pulse shadow-[2px_2px_0px_#000]">
                {timeFreezeInfo.reason === 'READING_BUFFER' ? (
                  <>
                    <Clock className="w-3.5 h-3.5 text-cyan-300 animate-spin" />
                    <span>CHUẨN BỊ (2S)</span>
                  </>
                ) : (
                  <>
                    <Snowflake className="w-3.5 h-3.5 animate-spin" />
                    <span>TIME FREEZE</span>
                  </>
                )}
              </div>
            ) : isPaused ? (
              <div className="h-9 flex items-center gap-1.5 px-3 bg-amber-950 border border-amber-400 text-amber-300 text-xs font-bold shadow-[2px_2px_0px_#000]">
                <Pause className="w-3.5 h-3.5" />
                <span>TẠM DỪNG</span>
              </div>
            ) : (
              <div className="h-9 flex items-center gap-2 px-3 text-rose-400 font-bold text-xs bg-neutral-950 border border-neutral-700 shadow-[2px_2px_0px_#000]">
                <span className="text-neutral-400">LƯỢT NÓI:</span>
                <span className="text-base text-rose-500 font-extrabold tracking-wider">
                  00:{turnRemaining.toString().padStart(2, '0')}
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={onTogglePause}
              className="h-9 w-9 flex items-center justify-center bg-neutral-800 border border-neutral-600 hover:bg-neutral-700 text-neutral-200 shadow-[2px_2px_0px_#000]"
              title="Tạm dừng / Tiếp tục"
            >
              {isPaused ? <Play className="w-4 h-4 fill-white" /> : <Pause className="w-4 h-4" />}
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
                  -{hpDelta} HP (BỊ TRỪ MÁU)
                </span>
              )}
              {hpFlashType === 'heal' && (
                <span className="ml-2 px-1.5 py-0.5 bg-emerald-500 text-black font-extrabold text-[10px] animate-bounce border border-emerald-300 shadow-[2px_2px_0px_#000]">
                  +{hpDelta} HP (HỒI MÁU)
                </span>
              )}
            </span>
          </div>

          {/* Thanh Máu Liên Tục Chuẩn Xác 0 - 100% (Hiển thị chính xác từng % với vạch phân chia Retro) */}
          <div className="relative w-full h-4 bg-neutral-900 border border-neutral-700 p-0.5 overflow-hidden">
            {/* Lớp thanh máu chạy chuẩn xác theo hp% */}
            <div
              className={`h-full transition-all duration-300 ease-out ${
                hp <= 20
                  ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]'
                  : hp <= 50
                  ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]'
                  : 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
              }`}
              style={{ width: `${Math.max(0, Math.min(100, hp))}%` }}
            />

            {/* Vạch kẻ phân đoạn Retro (Ticks mỗi 10%) giữ trọn chất Arcade */}
            <div className="absolute inset-0 flex pointer-events-none px-0.5 py-0.5">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 border-r border-black/30 last:border-r-0 h-full"
                />
              ))}
            </div>
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
