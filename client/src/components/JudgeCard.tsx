import React from 'react';
import {
  JuryBossId,
  JURY_BOSS_PROFILES,
} from '@pitcharena/shared';
import { Coins, Cpu, ShieldAlert, Radio } from 'lucide-react';

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
      case JuryBossId.FINANCE_DRAGON:
        return <Coins className="w-5 h-5 text-amber-600" />;
      case JuryBossId.TECH_SENTINEL:
        return <Cpu className="w-5 h-5 text-cyan-600" />;
      case JuryBossId.MARKET_SHARK:
        return <ShieldAlert className="w-5 h-5 text-rose-600" />;
      default:
        return <Radio className="w-5 h-5 text-neutral-600" />;
    }
  };

  return (
    <div
      onClick={() => onSelect && onSelect(bossId)}
      className={`relative border-2 border-black transition-all duration-200 select-none ${
        onSelect ? 'cursor-pointer' : ''
      } ${
        isActive
          ? 'bg-amber-50/90 border-black shadow-[4px_4px_0px_#eab308] translate-x-[-1px] translate-y-[-1px]'
          : isDimmed
          ? 'bg-neutral-100 opacity-25 grayscale hover:opacity-50'
          : 'bg-white shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000]'
      }`}
    >
      {/* Top Banner Tag */}
      <div className="flex items-center justify-between border-b-2 border-black px-3 py-1.5 bg-black text-white font-mono text-[11px]">
        <div className="flex items-center gap-1.5 font-bold">
          {renderIcon()}
          <span>{profile.name.toUpperCase()}</span>
        </div>
        <span className="text-amber-400 font-bold">LV.{profile.level}</span>
      </div>

      {/* Body Content */}
      <div className="p-3 flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[11px] font-mono">
          <span className="text-neutral-500 font-bold">{profile.domain}</span>
          {isActive && (
            <span className="px-1.5 py-0.5 bg-amber-400 text-black font-bold text-[10px] animate-pulse">
              {isSpeaking ? 'ĐANG CHẤT VẤN' : 'LƯỢT HIỆN TẠI'}
            </span>
          )}
        </div>

        <p className="text-xs text-neutral-700 line-clamp-2 leading-relaxed">
          {profile.focus}
        </p>

        {/* Style Footer */}
        <div className="pt-2 mt-1 border-t border-dashed border-neutral-300 text-[10px] font-mono text-neutral-500 italic">
          "{profile.signatureStyle}"
        </div>
      </div>
    </div>
  );
};
