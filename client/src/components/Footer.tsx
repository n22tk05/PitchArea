import React from 'react';
import { Gavel } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-[#FAF8F5] border-t border-[#D97706]/20 py-8">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 font-mono text-xs text-[#78716C] font-bold">
        <div className="group flex items-center gap-2 cursor-default select-none">
          <Gavel className="w-4 h-4 text-[#B45309] group-hover:-rotate-12 transition-transform duration-200" />
          <span className="text-[#1C1917] uppercase font-pixel text-[10px] group-hover:text-[#B45309] transition-all duration-200">
            PITCH·ARENA STUDIO // NESTJS & REACTJS ARCHITECTURE
          </span>
        </div>
        <div className="flex items-center gap-4 text-[#78716C]">
          <span className="flex items-center gap-1.5 font-pixel text-[9px]">
            <span className="w-2 h-2 rounded-full bg-[#D97706] shadow-[0_0_8px_rgba(217,119,6,0.6)] animate-pulse" />
            <span>STYLED WITH WARM BRONZE GAME TOKENS</span>
          </span>
          <span>•</span>
          <span className="text-[#B45309] font-pixel text-[10px]">2026 UNIVERSITY EDITION</span>
        </div>
      </div>
    </footer>
  );
};
