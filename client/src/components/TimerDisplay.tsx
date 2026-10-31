import React from 'react';
import { Timer, FastForward, Pause, Play } from 'lucide-react';
import { SessionFsmState } from '@pitcharena/shared';

interface TimerDisplayProps {
  fsmState: SessionFsmState;
  prepRemainingSeconds: number;
  turnRemainingSeconds: number;
  isPaused: boolean;
  onSkipPrep?: () => void;
  onTogglePause?: () => void;
}

export const TimerDisplay: React.FC<TimerDisplayProps> = ({
  fsmState,
  prepRemainingSeconds,
  turnRemainingSeconds,
  isPaused,
  onSkipPrep,
  onTogglePause,
}) => {
  const isPrep = fsmState === SessionFsmState.PREP_BUFFER;
  const isCombat = fsmState === SessionFsmState.COMBAT_ACTIVE;
  const currentSeconds = isPrep ? prepRemainingSeconds : turnRemainingSeconds;

  const formattedSeconds = String(currentSeconds).padStart(2, '0');

  // Trạng thái thanh tiến trình
  const maxSeconds = isPrep ? 3 : 30;
  const progressPercent = Math.max(0, Math.min(100, (currentSeconds / maxSeconds) * 100));

  return (
    <div className="border border-[#D97706]/30 bg-[#FFFFFF] p-4 rounded-2xl shadow-xs flex flex-col gap-3">
      {/* Top Header */}
      <div className="flex items-center justify-between text-[11px] font-mono border-b border-[#D97706]/15 pb-2">
        <div className="flex items-center gap-1.5 font-bold">
          <Timer className="w-4 h-4 text-[#D97706]" />
          {isPrep && (
            <span className="text-[#92400E] bg-[#FEF3C7] px-2 py-0.5 border border-[#F59E0B]/50 rounded-md font-pixel text-[10px]">
              [ 03s PREP BUFFER: ĐỆM SUY NGHĨ ]
            </span>
          )}
          {isCombat && (
            <span className="text-rose-800 bg-rose-50 px-2 py-0.5 border border-rose-300 rounded-md font-pixel text-[10px]">
              [ 30s COMBAT: ĐỐI CHẤT TRỰC TIẾP ]
            </span>
          )}
          {!isPrep && !isCombat && (
            <span className="text-[#57534E] bg-[#FAF8F5] px-2 py-0.5 border border-[#D97706]/20 rounded-md font-pixel text-[10px]">
              [ STANDBY: SẴN SÀNG ]
            </span>
          )}
        </div>

        {isPaused && (
          <span className="text-[#B45309] font-bold animate-pulse text-[10px] font-pixel">
            ⏸ TẠM DỪNG CHIẾN THUẬT
          </span>
        )}
      </div>

      {/* Main Arcade Timer Value */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-baseline gap-1.5">
          <span className="font-headline text-4xl font-black tracking-wider text-[#1C1917]">
            00:{formattedSeconds}
          </span>
          <span className="font-mono text-xs text-[#78716C] font-bold">SEC</span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {isPrep && onSkipPrep && (
            <button
              onClick={onSkipPrep}
              className="px-3 py-1.5 bg-[#FEF3C7] border border-[#F59E0B]/60 text-[#92400E] font-pixel text-[10px] font-bold shadow-xs hover:bg-[#FDE68A] active:translate-x-0.5 rounded-lg flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <FastForward className="w-3 h-3" />
              <span>BỎ QUA ĐỆM</span>
            </button>
          )}

          {(isPrep || isCombat) && onTogglePause && (
            <button
              onClick={onTogglePause}
              className="px-3 py-1.5 bg-[#FAF8F5] border border-[#D97706]/35 text-[#1C1917] font-pixel text-[10px] font-bold shadow-xs hover:bg-[#FEF3C7] active:translate-x-0.5 rounded-lg flex items-center gap-1 cursor-pointer transition-all"
            >
              {isPaused ? (
                <>
                  <Play className="w-3 h-3 fill-[#1C1917] text-[#1C1917]" />
                  <span>TIẾP TỤC</span>
                </>
              ) : (
                <>
                  <Pause className="w-3 h-3 text-[#1C1917]" />
                  <span>TẠM DỪNG</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Retro Progress Bar */}
      <div className="w-full bg-[#FAF8F5] h-2 border border-[#D97706]/20 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 rounded-full ${
            isPrep
              ? 'bg-[#F59E0B]'
              : progressPercent <= 20
              ? 'bg-rose-500'
              : 'bg-[#B45309]'
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
};
