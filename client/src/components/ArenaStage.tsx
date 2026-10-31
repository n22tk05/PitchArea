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
  Clock,
  SkipForward,
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

  // Phán quyết gần nhất từ Hội đồng trọng tài
  const effectiveVerdict = lastVerdict || sessionState?.lastVerdict;

  // Lắng nghe phán quyết trọng tài và biến động HP để kích hoạt hiệu ứng thị giác (Heal / Damage)
  const lastProcessedVerdictKey = useRef<string | null>(null);

  useEffect(() => {
    if (effectiveVerdict) {
      const verdictKey = `${effectiveVerdict.turnIndex}_${effectiveVerdict.hpDelta}_${effectiveVerdict.score.overallScore}_${effectiveVerdict.reason}`;
      if (lastProcessedVerdictKey.current !== verdictKey) {
        lastProcessedVerdictKey.current = verdictKey;

        // Nếu là hồi máu (isHeal = true hoặc hpDelta > 0): Luôn hiển thị hiệu ứng HỒI MÁU
        if (effectiveVerdict.isHeal || effectiveVerdict.hpDelta > 0) {
          setHpDelta(Math.abs(effectiveVerdict.hpDelta) || 5);
          setHpFlashType('heal');
        } else if (effectiveVerdict.hpDelta < 0) {
          setHpDelta(Math.abs(effectiveVerdict.hpDelta));
          setHpFlashType('damage');
        }

        const timer = setTimeout(() => {
          setHpFlashType(null);
        }, 1200);

        prevHpRef.current = hp;
        return () => clearTimeout(timer);
      }
    }

    // Trường hợp biến động HP ngoài phán quyết (hoặc fallback)
    if (prevHpRef.current !== null && prevHpRef.current !== hp) {
      const diff = hp - prevHpRef.current;
      if (!lastProcessedVerdictKey.current || !effectiveVerdict) {
        setHpDelta(Math.abs(diff));
        if (diff > 0) {
          setHpFlashType('heal');
        } else if (diff < 0) {
          setHpFlashType('damage');
        }
        const timer = setTimeout(() => {
          setHpFlashType(null);
        }, 1200);
        prevHpRef.current = hp;
        return () => clearTimeout(timer);
      }
    }
    prevHpRef.current = hp;
  }, [hp, effectiveVerdict]);

  // Kiểm tra phán quyết gần nhất
  const isAnswerCorrect = useMemo(() => {
    if (!effectiveVerdict) return false;
    return (
      (effectiveVerdict.isHeal || effectiveVerdict.hpDelta > 0) &&
      effectiveVerdict.score.overallScore >= 65 &&
      !effectiveVerdict.isShieldProtected
    );
  }, [effectiveVerdict]);

  // Thông tin chuỗi phản biện (Streak)
  const streakInfo = useMemo(() => {
    if (sessionState?.streak) {
      return sessionState.streak;
    }
    if (effectiveVerdict?.streakCount !== undefined) {
      return {
        count: effectiveVerdict.streakCount,
        type: (effectiveVerdict.score.overallScore >= 70
          ? 'WIN'
          : effectiveVerdict.score.overallScore < 50
          ? 'LOSE'
          : 'NEUTRAL') as 'WIN' | 'LOSE' | 'NEUTRAL',
      };
    }
    return { count: 0, type: 'NEUTRAL' as const };
  }, [sessionState?.streak, effectiveVerdict]);

  const [localIsPaused, setLocalIsPaused] = useState<boolean | null>(null);

  const isFrozen = timeFreezeInfo.isFrozen || sessionState?.isTimeFrozen;
  const isPaused =
    localIsPaused !== null
      ? localIsPaused
      : sessionState?.isPaused !== undefined
      ? sessionState.isPaused
      : (timerData?.isPaused ?? false);
  const fsmState = timerData?.fsmState || sessionState?.fsmState;

  const handleTogglePauseClick = () => {
    setLocalIsPaused((prev) => {
      const current =
        prev !== null
          ? prev
          : sessionState?.isPaused !== undefined
          ? sessionState.isPaused
          : (timerData?.isPaused ?? false);
      return !current;
    });
    onTogglePause();
  };

  // Đếm ngược Tổng thời gian Q&A theo giây
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

  // Lọc Giám khảo có khối đề mục tồn tại trong tài liệu
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

  const turnRemaining =
    timerData?.turnRemainingSeconds ??
    sessionState?.turnRemainingSeconds ??
    30;

  const handleDefenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isFrozen || isPaused) return;
    const text = manualDefenseText.trim() || interimTranscript.trim();
    if (text) {
      onSubmitDefense(text);
      setManualDefenseText('');
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full font-mono text-[#1C1917]">
      {/* 2. KHUNG ĐẤU TRƯỜNG CHÍNH (Arena Viewport) */}
      <div
        className={`relative border p-6 rounded-2xl flex flex-col gap-5 overflow-hidden transition-all duration-300 ${
          hpFlashType === 'damage'
            ? 'border-rose-400 bg-rose-50 shadow-[0_0_35px_rgba(225,29,72,0.25)]'
            : hpFlashType === 'heal'
            ? 'border-emerald-400 bg-emerald-50 shadow-[0_0_35px_rgba(16,185,129,0.25)]'
            : isAnswerCorrect
            ? 'border-emerald-400 bg-[#FFFFFF] shadow-[0_0_25px_rgba(16,185,129,0.15)]'
            : 'bg-[#FFFFFF] border-[#D97706]/30 shadow-xs'
        }`}
      >
        {/* Header Sàn Đấu */}
        <div className="relative z-10 flex flex-wrap items-center justify-between pb-4 border-b border-[#D97706]/20 gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-[#57534E] font-sans font-bold">
              GIÁM KHẢO: <span className="text-[#B45309] font-headline font-black text-sm uppercase">{JURY_BOSS_PROFILES[activeBossId].name}</span>
            </span>

            {streakInfo.count >= 2 && (
              <span
                className={`px-2.5 py-0.5 text-xs font-pixel font-bold flex items-center gap-1.5 rounded-full border shadow-xs ${
                  streakInfo.type === 'WIN'
                    ? 'bg-[#FEF3C7] border-[#F59E0B]/60 text-[#92400E]'
                    : 'bg-rose-100 border-rose-300 text-rose-800'
                }`}
              >
                <Flame className="w-3.5 h-3.5 text-[#D97706]" />
                <span>Streak {streakInfo.count}</span>
              </span>
            )}
          </div>

          {/* Cụm đồng hồ */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* 1. Tổng Quỹ Thời Gian Q&A */}
            <div className="h-10 flex items-center gap-2 px-3.5 bg-[#FAF8F5] border border-[#D97706]/25 rounded-xl text-xs font-bold shadow-xs">
              <Clock className="w-4 h-4 text-[#D97706] shrink-0" />
              <span className="text-[#78716C]">Thời gian Q&A:</span>
              <span className="text-sm text-[#1C1917] font-headline font-black tracking-wider">
                {formatQaTime(qaRemainingSeconds)}
              </span>
              <span className="text-[10px] text-[#A8A29E] font-normal">
                / {configuredQaMinutes.toString().padStart(2, '0')}:00
              </span>
            </div>

            {/* Tag Đánh Giá Câu Trả Lời Trước */}
            {effectiveVerdict && (
              <div
                className={`h-10 flex items-center gap-2 px-3 border text-xs font-pixel font-bold rounded-xl shadow-xs transition-all duration-200 ${
                  effectiveVerdict.score.overallScore >= 65 || effectiveVerdict.hpDelta > 0
                    ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                    : effectiveVerdict.score.overallScore >= 50 || effectiveVerdict.hpDelta === 0
                    ? 'bg-[#FAF8F5] border-[#D97706]/25 text-[#57534E]'
                    : 'bg-rose-100 border-rose-300 text-rose-800'
                }`}
              >
                {effectiveVerdict.score.overallScore >= 65 || effectiveVerdict.hpDelta > 0 ? (
                  <span>CÂU TRƯỚC: TỐT</span>
                ) : effectiveVerdict.score.overallScore >= 50 || effectiveVerdict.hpDelta === 0 ? (
                  <span>CÂU TRƯỚC: BÌNH THƯỜNG</span>
                ) : (
                  <span>CÂU TRƯỚC: TỆ</span>
                )}
              </div>
            )}

            {/* 2. Đồng hồ đối chất lượt (30s) */}
            {isPaused ? (
              <div className="h-10 flex items-center gap-2 px-3.5 bg-[#FEF3C7] border border-[#F59E0B]/50 text-[#92400E] text-xs font-pixel font-bold rounded-xl shadow-xs">
                <Pause className="w-3.5 h-3.5" />
                <span>TẠM DỪNG</span>
              </div>
            ) : isFrozen ? (
              <div className="h-10 flex items-center gap-2 px-3.5 bg-cyan-100 border border-cyan-300 text-cyan-800 text-xs font-pixel font-bold animate-pulse rounded-xl shadow-xs">
                {timeFreezeInfo.reason === 'READING_BUFFER' || fsmState === SessionFsmState.PREP_BUFFER ? (
                  <>
                    <Clock className="w-3.5 h-3.5 text-cyan-700 animate-spin" />
                    <span>CHUẨN BỊ (2S)</span>
                  </>
                ) : (
                  <>
                    <Snowflake className="w-3.5 h-3.5 text-cyan-700 animate-spin" />
                    <span>THINKING</span>
                  </>
                )}
              </div>
            ) : (
              <div className="h-10 flex items-center gap-2 px-3.5 text-rose-700 font-bold text-xs bg-rose-50 border border-rose-200 rounded-xl shadow-xs">
                <span className="text-[#78716C] font-sans">LƯỢT NÓI:</span>
                <span className="text-sm text-rose-700 font-headline font-black tracking-wider">
                  00:{turnRemaining.toString().padStart(2, '0')}
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={handleTogglePauseClick}
              className="h-10 w-10 flex items-center justify-center bg-[#FAF8F5] border border-[#D97706]/35 hover:bg-[#FEF3C7] text-[#1C1917] rounded-xl transition-all cursor-pointer shadow-xs"
              title="Tạm dừng / Tiếp tục"
            >
              {isPaused ? <Play className="w-4 h-4 fill-[#1C1917]" /> : <Pause className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Thanh Máu Thí Sinh */}
        <div className="relative z-10 flex flex-col gap-2 bg-[#FAF8F5] p-4 border border-[#D97706]/20 rounded-xl">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 font-bold text-[#1C1917]">
              <ShieldAlert className="w-4 h-4 text-[#D97706]" />
              <span className="font-headline tracking-wide uppercase">THANH MÁU THÍ SINH: <span className="text-[#B45309] font-black">{hp}%</span></span>
              {hpFlashType === 'damage' && (
                <span className="ml-2 px-2 py-0.5 bg-rose-600 text-white font-pixel text-[10px] animate-bounce rounded-full shadow-xs">
                  -{hpDelta} HP (BỊ TRỪ MÁU)
                </span>
              )}
              {hpFlashType === 'heal' && (
                <span className="ml-2 px-2 py-0.5 bg-emerald-600 text-white font-pixel text-[10px] animate-bounce rounded-full shadow-xs">
                  +{hpDelta} HP (HỒI MÁU)
                </span>
              )}
            </span>

            {/* Trạng thái Khiên tân thủ 20% */}
            <div className="flex items-center gap-2 text-[10px] font-bold">
              {(sessionState?.currentTurn ?? 1) <= 3 ? (
                <span className="px-2.5 py-1 bg-[#FEF3C7] text-[#92400E] border border-[#F59E0B]/50 rounded-full shadow-xs flex items-center gap-1.5 font-pixel">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#D97706]" />
                  KHIÊN TÂN THỦ: SÀN {sessionState?.config?.pedagogicalShieldFloor ?? 20}% (LƯỢT {sessionState?.currentTurn ?? 1}/3)
                </span>
              ) : hp <= 20 ? (
                <span className="px-2.5 py-1 bg-rose-100 text-rose-800 border border-rose-300 animate-pulse rounded-full flex items-center gap-1.5 font-pixel">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                  KHIÊN ĐÃ VỠ (SÀN 0% - NGUY HIỂM)
                </span>
              ) : (
                <span className="px-2.5 py-1 bg-[#FFFFFF] text-[#78716C] border border-[#D97706]/20 rounded-full font-pixel">
                  KHIÊN ĐÃ HẾT HIỆU LỰC
                </span>
              )}
            </div>
          </div>

          {/* Thanh Máu Liên Tục */}
          <div className="relative w-full h-4 bg-[#FFFFFF] border border-[#D97706]/30 p-0.5 overflow-hidden rounded-full shadow-inner">
            <div
              className={`h-full transition-all duration-300 ease-out rounded-full ${
                hp <= 20
                  ? 'bg-rose-500'
                  : hp <= 50
                  ? 'bg-amber-500'
                  : 'bg-gradient-to-r from-[#D97706] to-emerald-600'
              }`}
              style={{ width: `${Math.max(0, Math.min(100, hp))}%` }}
            />
          </div>
        </div>

        {/* Coaching Pivot Alert Banner (Strike 2) */}
        {coachingAlert && (
          <div className="relative z-10 bg-[#FEF3C7] border border-[#F59E0B]/60 p-4 flex items-start gap-3 animate-fadeIn rounded-xl shadow-xs">
            <Sparkles className="w-5 h-5 text-[#D97706] shrink-0 mt-0.5 animate-bounce" />
            <div className="flex flex-col gap-1 text-xs">
              <div className="flex items-center gap-2">
                <span className="bg-[#92400E] text-white font-pixel font-bold px-2 py-0.5 rounded-full text-[9px]">
                  STRIKE 2 // COACHING PIVOT
                </span>
                <span className="text-[#92400E] font-bold font-sans">
                  Hội đồng chuyển hướng sư phạm hỗ trợ
                </span>
              </div>
              <p className="text-[#57534E] leading-relaxed font-sans mt-0.5">
                {coachingAlert.message}
              </p>
            </div>
          </div>
        )}

        {/* Khung Câu Hỏi Giám Khảo */}
        <div className="relative z-10 bg-[#FAF8F5] border border-[#D97706]/25 rounded-xl p-5 flex flex-col gap-2 min-h-[110px] shadow-xs">
          <div className="text-sm text-[#1C1917] leading-relaxed font-sans font-medium">
            {streamingQuestion?.accumulatedText ? (
              <span>
                "{streamingQuestion.accumulatedText}"
                {!streamingQuestion.isComplete && (
                  <span className="inline-block w-2 h-4 bg-[#D97706] ml-1 animate-pulse" />
                )}
              </span>
            ) : (
              <span className="text-[#78716C] italic flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-[#D97706] animate-spin" />
                <span>Giám khảo đang xem xét hồ sơ và chuẩn bị đưa ra câu hỏi...</span>
              </span>
            )}
          </div>
        </div>

        {/* Khung Thí Sinh Phản Biện & Thu Âm */}
        <form onSubmit={handleDefenseSubmit} className="relative z-10 flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs text-[#57534E]">
            <span className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isRecording ? 'bg-rose-500 animate-ping' : 'bg-[#78716C]'}`} />
              <span className="font-headline font-bold tracking-wider text-[#1C1917]">THÍ SINH PHẢN BIỆN:</span>
            </span>

            <button
              type="button"
              onClick={onToggleRecord}
              className={`px-3.5 py-1.5 text-xs font-pixel font-bold border rounded-lg flex items-center gap-2 transition-all cursor-pointer ${
                isRecording
                  ? 'bg-rose-600 border-rose-500 text-white animate-pulse shadow-sm'
                  : 'bg-[#FAF8F5] border-[#D97706]/35 text-[#1C1917] hover:bg-[#FEF3C7] shadow-xs'
              }`}
            >
              <Mic className="w-4 h-4 text-[#D97706]" />
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
              className="w-full bg-[#FAF8F5] border border-[#D97706]/30 rounded-xl p-3.5 text-xs text-[#1C1917] placeholder-[#A8A29E] focus:outline-none focus:border-[#B45309] resize-none font-sans shadow-xs"
            />
            {interimTranscript && (
              <div className="text-xs text-[#B45309] italic px-3.5 pb-2.5 bg-[#FAF8F5] border-x border-b border-[#D97706]/30 rounded-b-xl">
                Đang nhận diện giọng nói: {interimTranscript}...
              </div>
            )}
          </div>

          {/* Thanh Nút Hành Động */}
          <div className="flex items-center justify-between pt-1 gap-3">
            <button
              type="button"
              onClick={onRequestNextQuestion}
              disabled={isFrozen || isPaused}
              className="px-4 py-2.5 bg-[#FAF8F5] hover:bg-rose-50 border border-[#D97706]/30 hover:border-rose-300 text-[#78716C] hover:text-rose-700 font-bold text-xs flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-all cursor-pointer shadow-xs"
              title="Bỏ qua câu hỏi này và chấp nhận bị phán quyết trừ điểm máu (HP)"
            >
              <SkipForward className="w-4 h-4 text-rose-600" />
              <span>BỎ QUA CÂU NÀY (-HP)</span>
            </button>

            <button
              type="submit"
              disabled={isFrozen || isPaused || (!manualDefenseText.trim() && !interimTranscript.trim())}
              className="px-6 py-2.5 bg-[#B45309] hover:bg-[#92400E] text-white font-pixel font-bold text-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer shadow-xs rounded-xl transition-all"
            >
              <span>NỘP BÀI PHẢN BIỆN (SUBMIT)</span>
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
