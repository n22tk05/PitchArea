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
    <div className="border-2 border-black bg-white p-3 shadow-[4px_4px_0px_#000] flex flex-col gap-2">
      {/* Top Header */}
      <div className="flex items-center justify-between text-[11px] font-mono border-b border-black/20 pb-1.5">
        <div className="flex items-center gap-1.5 font-bold">
          <Timer className="w-3.5 h-3.5 text-black" />
          {isPrep && (
            <span className="text-amber-600 bg-amber-50 px-1.5 py-0.5 border border-amber-300">
              [ 03s PREP BUFFER: ĐỆM SUY NGHĨ ]
            </span>
          )}
          {isCombat && (
            <span className="text-rose-600 bg-rose-50 px-1.5 py-0.5 border border-rose-300">
              [ 30s COMBAT: ĐỐI CHẤT TRỰC TIẾP ]
            </span>
          )}
          {!isPrep && !isCombat && (
            <span className="text-neutral-600 bg-neutral-100 px-1.5 py-0.5 border border-neutral-300">
              [ STANDBY: SẴN SÀNG ]
            </span>
          )}
        </div>

        {isPaused && (
          <span className="text-amber-600 font-bold animate-pulse text-[10px]">
            ⏸ TẠM DỪNG CHIẾN THUẬT
          </span>
        )}
      </div>

      {/* Main Arcade Timer Value */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-4xl font-black tracking-wider text-black">
            00:{formattedSeconds}
          </span>
          <span className="font-mono text-xs text-neutral-500 font-bold">SEC</span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {isPrep && onSkipPrep && (
            <button
              onClick={onSkipPrep}
              className="px-2.5 py-1.5 bg-amber-400 border-2 border-black text-black font-mono text-[11px] font-bold shadow-[2px_2px_0px_#000] hover:bg-amber-300 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none flex items-center gap-1.5"
            >
              <FastForward className="w-3 h-3" />
              BỎ QUA ĐỆM
            </button>
          )}

          {(isPrep || isCombat) && onTogglePause && (
            <button
              onClick={onTogglePause}
              className="px-2.5 py-1.5 bg-neutral-100 border-2 border-black text-black font-mono text-[11px] font-bold shadow-[2px_2px_0px_#000] hover:bg-neutral-200 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none flex items-center gap-1"
            >
              {isPaused ? (
                <>
                  <Play className="w-3 h-3 fill-black" />
                  TIẾP TỤC
                </>
              ) : (
                <>
                  <Pause className="w-3 h-3" />
                  TẠM DỪNG
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Retro Pixel Progress Bar */}
      <div className="w-full h-2 bg-neutral-200 border border-black overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            isPrep ? 'bg-amber-500' : currentSeconds <= 5 ? 'bg-rose-500 animate-pulse' : 'bg-black'
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
};
