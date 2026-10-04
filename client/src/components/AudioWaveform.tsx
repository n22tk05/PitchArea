import React, { useMemo } from 'react';
import { Mic, MicOff } from 'lucide-react';

interface AudioWaveformProps {
  isRecording: boolean;
  audioLevel: number; // 0 to 100
  estimatedWpm?: number;
  isSilent?: boolean;
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  isRecording,
  audioLevel,
  estimatedWpm = 0,
  isSilent = false,
}) => {
  // Đánh giá nhịp độ WPM chuẩn phong cách Pitching
  const wpmStatus = useMemo(() => {
    if (estimatedWpm === 0) return { label: 'CHỜ PHÁT ÂM', color: 'text-neutral-400' };
    if (estimatedWpm < 110) return { label: 'HƠI CHẬM', color: 'text-amber-600' };
    if (estimatedWpm <= 165) return { label: 'CHUẨN NHỊP', color: 'text-emerald-600' };
    return { label: 'QUÁ NHANH', color: 'text-rose-600' };
  }, [estimatedWpm]);

  // Tạo 24 cột sóng âm thanh pixel
  const bars = useMemo(() => {
    return Array.from({ length: 24 }).map((_, index) => {
      // Phân bổ sóng đối xứng quanh tâm
      const distanceFromCenter = Math.abs(index - 11.5) / 11.5;
      const factor = Math.max(0.15, 1 - distanceFromCenter * 0.7);

      if (!isRecording) {
        return 4; // Độ cao tĩnh khi tắt mic
      }

      // Độ cao biến thiên kết hợp với audioLevel thật (chỉ dao động khi có âm thanh thực tế)
      const baseHeight = (audioLevel / 100) * 38 * factor;
      const jitter =
        audioLevel > 6
          ? Math.sin(index * 1.5 + Date.now() / 120) * 4 * (audioLevel / 50)
          : 0;
      return Math.max(3, Math.min(40, Math.round(baseHeight + jitter)));
    });
  }, [isRecording, audioLevel]);

  return (
    <div className="border-2 border-black bg-white p-3 shadow-[4px_4px_0px_#000] flex flex-col gap-2">
      {/* Top Header Status */}
      <div className="flex items-center justify-between text-[11px] font-mono border-b border-black/20 pb-1.5">
        <div className="flex items-center gap-2">
          {isRecording ? (
            <span className="flex items-center gap-1.5 text-emerald-600 font-bold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <Mic className="w-3.5 h-3.5" />
              MIC ACTIVE [220ms STREAM]
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-neutral-500 font-bold">
              <MicOff className="w-3.5 h-3.5" />
              MIC STANDBY
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {isRecording && (
            <span className="flex items-center gap-1.5 text-neutral-700">
              <span>WPM:</span>
              <strong className="text-black font-bold font-mono">
                {estimatedWpm > 0 ? estimatedWpm : '--'}
              </strong>
              {estimatedWpm > 0 && (
                <span
                  className={`text-[9px] font-bold px-1 border border-black/30 bg-neutral-50 ${wpmStatus.color}`}
                >
                  [{wpmStatus.label}]
                </span>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Retro Pixel Waveform Bars */}
      <div className="h-11 flex items-end justify-between gap-1 px-1 bg-neutral-900 border border-black/40">
        {bars.map((height, i) => {
          const isHigh = height > 24;
          return (
            <div
              key={i}
              className={`flex-1 transition-all duration-75 ${
                !isRecording
                  ? 'bg-neutral-700'
                  : isHigh
                  ? 'bg-amber-400'
                  : 'bg-emerald-400'
              }`}
              style={{
                height: `${height}px`,
                minWidth: '2px',
              }}
            />
          );
        })}
      </div>
    </div>
  );
};
