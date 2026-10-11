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

  const getBossColor = (bossId: JuryBossId) => {
    switch (bossId) {
      case JuryBossId.FINANCE_DRAGON:
        return 'text-amber-500 border-amber-500';
      case JuryBossId.TECH_SENTINEL:
        return 'text-blue-500 border-blue-500';
      case JuryBossId.MARKET_SHARK:
        return 'text-emerald-500 border-emerald-500';
      default:
        return 'text-purple-500 border-purple-500';
    }
  };

  const getHpBarColor = (hp: number) => {
    if (hp <= 20) return 'bg-rose-500';
    if (hp <= 50) return 'bg-amber-400';
    return 'bg-emerald-400';
  };

  return (
    <div className="border-2 border-black bg-white p-4 shadow-[4px_4px_0px_#000] flex flex-col gap-3 font-mono">
      <div className="flex items-center justify-between pb-2 border-b border-black/20">
        <div className="flex items-center gap-2 text-xs font-bold">
          <Activity className="w-4 h-4 text-rose-600" />
          <span>BIẾN THIÊN THANH MÁU THEO TỪNG LƯỢT ĐỐI CHẤT (HP TIMELINE)</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-neutral-600">
          <span className="flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-neutral-500" />
            Sàn bảo hiểm: <strong>{shieldFloor}%</strong>
          </span>
          <span>Khởi đầu: <strong>100%</strong></span>
        </div>
      </div>

      {/* Grid biểu đồ các mốc lượt */}
      <div className="flex items-end gap-2 pt-6 pb-2 overflow-x-auto min-h-[140px] px-2 border-b border-dashed border-neutral-300">
        {hpHistory.map((point, idx) => {
          const heightPercent = Math.max(12, Math.min(100, point.hp));
          const isFloorActive = point.hp <= shieldFloor;

          return (
            <div
              key={idx}
              className="flex-1 min-w-[54px] max-w-[80px] flex flex-col items-center gap-1 group relative"
            >
              {/* Tooltip Hover */}
              <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-[10px] py-1 px-1.5 rounded pointer-events-none whitespace-nowrap z-20 shadow-md">
                Turn {point.turn}: {point.hp}% {point.hpDelta !== 0 && `(${point.hpDelta > 0 ? '+' : ''}${point.hpDelta})`}
              </div>

              {/* Nhãn HP trên đỉnh cột */}
              <span
                className={`text-[10px] font-bold ${
                  point.hpDelta < 0
                    ? 'text-rose-600'
                    : point.hpDelta > 0
                    ? 'text-emerald-600'
                    : 'text-neutral-600'
                }`}
              >
                {point.hp}%
              </span>

              {/* Cột Máu Pixel */}
              <div className="w-full h-24 bg-neutral-100 border border-black flex flex-col justify-end p-0.5 relative">
                {/* Đường kẻ sàn bảo hiểm 20% */}
                <div
                  className="absolute left-0 right-0 border-t border-rose-400 border-dashed z-10 pointer-events-none"
                  style={{ bottom: `${shieldFloor}%` }}
                />

                <div
                  className={`w-full transition-all duration-300 ${getHpBarColor(
                    point.hp
                  )} ${isFloorActive ? 'animate-pulse' : ''}`}
                  style={{ height: `${heightPercent}%` }}
                />
              </div>

              {/* Thông tin Lượt */}
              <span className="text-[10px] font-bold text-black mt-1">
                {point.turn === 0 ? 'START' : `T${point.turn}`}
              </span>

              {/* Delta Tag */}
              {point.hpDelta !== 0 && (
                <span
                  className={`text-[9px] px-1 font-extrabold border ${
                    point.hpDelta < 0
                      ? 'bg-rose-100 text-rose-700 border-rose-300'
                      : 'bg-emerald-100 text-emerald-700 border-emerald-300'
                  }`}
                >
                  {point.hpDelta > 0 ? `+${point.hpDelta}` : point.hpDelta}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-[10px] text-neutral-500">
        <span>* Đường nét đứt màu đỏ thể hiện Sàn Bảo Hiểm Tân Thủ 20% (Pedagogical Floor).</span>
        <span>Cập nhật tự động theo thời gian thực</span>
      </div>
    </div>
  );
};
