import React from 'react';
import {
  JuryBossId,
  JURY_BOSS_PROFILES,
} from '@pitcharena/shared';
import { Coins, Cpu, ShieldAlert, TrendingUp, Radio } from 'lucide-react';

interface JudgeCardProps {
  bossId: JuryBossId;
  isActive: boolean;
  isDimmed: boolean;
  isSpeaking?: boolean;
  onSelect?: (bossId: JuryBossId) => void;
}

export const JudgeCard: React.FC<JudgeCardProps> = ({
  bossId,
  isActive,
  isDimmed,
  isSpeaking = false,
  onSelect,
}) => {
  const profile = JURY_BOSS_PROFILES[bossId];

  const renderIcon = () => {
    switch (bossId) {
      case JuryBossId.MARKET_SHARK:
        return <TrendingUp className="w-4 h-4 text-cyan-700" />;
      case JuryBossId.TECH_SENTINEL:
        return <Cpu className="w-4 h-4 text-emerald-700" />;
      case JuryBossId.FINANCE_DRAGON:
        return <Coins className="w-4 h-4 text-[#D97706]" />;
      case JuryBossId.RISK_STRATEGIST:
        return <ShieldAlert className="w-4 h-4 text-rose-700" />;
      default:
        return <Radio className="w-4 h-4 text-[#78716C]" />;
    }
  };

  return (
    <div
      onClick={() => onSelect && onSelect(bossId)}
      className={`relative rounded-xl border transition-all duration-300 select-none overflow-hidden ${
        onSelect ? 'cursor-pointer' : ''
      } ${
        isActive
          ? 'bg-[#FFFFFF] border-2 border-[#D97706] shadow-[0_8px_24px_rgba(217,119,6,0.18)] -translate-y-1'
          : isDimmed
          ? 'bg-[#FAF8F5]/60 opacity-30 grayscale border-dashed border-[#D97706]/20'
          : 'bg-[#FAF8F5] border-[#D97706]/25 hover:border-[#D97706] shadow-xs hover:shadow-sm'
      }`}
    >
      {/* Top Banner Tag */}
      <div className="flex items-center justify-between border-b border-[#D97706]/20 px-3.5 py-2 bg-[#FAF8F5] text-[#1C1917] font-mono text-xs">
        <div className="flex items-center gap-2 font-bold">
          {renderIcon()}
          <span className="font-headline tracking-wide uppercase">{profile.name}</span>
        </div>
        <span className="text-[#92400E] font-pixel font-bold bg-[#FEF3C7] px-2 py-0.5 rounded-full border border-[#F59E0B]/50 text-[9px]">
          LV.{profile.level}
        </span>
      </div>

      {/* Body Content */}
      <div className="p-3.5 flex flex-col gap-2 bg-[#FFFFFF]">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-[#B45309] font-bold">{profile.domain}</span>
          {isActive && (
            <span className="px-2 py-0.5 bg-[#FEF3C7] text-[#92400E] border border-[#F59E0B]/50 font-pixel font-bold text-[9px] animate-pulse rounded-full shadow-xs">
              {isSpeaking ? 'ĐANG CHẤT VẤN' : 'LƯỢT HIỆN TẠI'}
            </span>
          )}
        </div>

        <p className="text-xs text-[#57534E] line-clamp-2 leading-relaxed font-sans">
          {profile.focus}
        </p>

        {/* Style Footer */}
        <div className="pt-2 mt-1 border-t border-[#D97706]/15 text-[11px] font-mono text-[#78716C] italic truncate">
          "{profile.signatureStyle}"
        </div>
      </div>
    </div>
  );
};
