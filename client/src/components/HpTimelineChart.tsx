import React from 'react';
import { HpHistoryPoint, JuryBossId } from '@pitcharena/shared';
import { Activity, Shield } from 'lucide-react';

interface HpTimelineChartProps {
  hpHistory: HpHistoryPoint[];
  shieldFloor?: number;
}

export const HpTimelineChart: React.FC<HpTimelineChartProps> = ({
  hpHistory,
  shieldFloor = 20,
}) => {
  if (!hpHistory || hpHistory.length === 0) {
    return null;
  }

  const getHpBarColor = (hp: number) => {
    if (hp <= 20) return 'bg-rose-500 shadow-sm';
    if (hp <= 50) return 'bg-amber-500 shadow-sm';
    return 'bg-emerald-500 shadow-sm';
  };

  return (
    <div className="p-6 rounded-2xl bg-[#FFFFFF] border border-[#D97706]/30 shadow-xs flex flex-col gap-4 font-mono text-[#1C1917]">
      <div className="flex items-center justify-between pb-3 border-b border-[#D97706]/20">
        <div className="flex items-center gap-2 text-xs font-bold font-headline text-[#1C1917] tracking-wide">
          <Activity className="w-4 h-4 text-[#D97706]" />
          <span>BIẾN THIÊN THANH MÁU THEO TỪNG LƯỢT ĐỐI CHẤT (HP TIMELINE)</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-[#78716C]">
          <span className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-[#D97706]" />
            Sàn bảo hiểm: <strong className="text-[#92400E] font-pixel">{shieldFloor}%</strong>
          </span>
          <span>Khởi đầu: <strong className="text-[#1C1917] font-pixel">100%</strong></span>
        </div>
      </div>

      {/* Grid biểu đồ các mốc lượt */}
      <div className="flex items-end gap-3 pt-6 pb-3 overflow-x-auto min-h-[150px] px-3 bg-[#FAF8F5] border border-[#D97706]/20 rounded-xl">
        {hpHistory.map((point, idx) => {
          const heightPercent = Math.max(12, Math.min(100, point.hp));
          const isFloorActive = point.hp <= shieldFloor;

          return (
            <div
              key={idx}
              className="flex-1 min-w-[56px] max-w-[80px] flex flex-col items-center gap-1.5 group relative"
            >
              {/* Tooltip Hover */}
              <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-[#1C1917] border border-[#44403C] text-white text-[10px] py-1 px-2 rounded-lg pointer-events-none whitespace-nowrap z-20 shadow-md">
                Turn {point.turn}: {point.hp}% {point.hpDelta !== 0 && `(${point.hpDelta > 0 ? '+' : ''}${point.hpDelta})`}
              </div>

              {/* Nhãn HP trên đỉnh cột */}
              <span
                className={`text-[10px] font-pixel font-bold ${
                  point.hpDelta < 0
                    ? 'text-rose-700'
                    : point.hpDelta > 0
                    ? 'text-emerald-700'
                    : 'text-[#78716C]'
                }`}
              >
                {point.hp}%
              </span>

              {/* Cột Máu */}
              <div className="w-full h-24 bg-[#FFFFFF] border border-[#D97706]/30 flex flex-col justify-end p-0.5 relative rounded-lg">
                {/* Đường kẻ sàn bảo hiểm 20% */}
                <div
                  className="absolute left-0 right-0 border-t border-rose-400 border-dashed z-10 pointer-events-none"
                  style={{ bottom: `${shieldFloor}%` }}
                />

                <div
                  className={`w-full transition-all duration-300 rounded-md ${getHpBarColor(
                    point.hp
                  )} ${isFloorActive ? 'animate-pulse' : ''}`}
                  style={{ height: `${heightPercent}%` }}
                />
              </div>

              {/* Thông tin Lượt */}
              <span className="text-[10px] font-pixel font-bold text-[#1C1917] mt-1">
                {point.turn === 0 ? 'START' : `T${point.turn}`}
              </span>

              {/* Delta Tag */}
              {point.hpDelta !== 0 && (
                <span
                  className={`text-[9px] px-1.5 py-0.5 font-pixel font-bold border rounded-full ${
                    point.hpDelta < 0
                      ? 'bg-rose-100 text-rose-800 border-rose-300'
                      : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  }`}
                >
                  {point.hpDelta > 0 ? `+${point.hpDelta}` : point.hpDelta}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-[10px] text-[#78716C] font-sans">
        <span>* Đường nét đứt màu đỏ thể hiện Sàn Bảo Hiểm Tân Thủ 20% (Pedagogical Floor).</span>
        <span className="font-bold text-[#B45309]">Cập nhật tự động theo thời gian thực</span>
      </div>
    </div>
  );
};
