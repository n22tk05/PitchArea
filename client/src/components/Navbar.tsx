import React from 'react';
import { Gavel, Play } from 'lucide-react';

interface NavbarProps {
  onStartClick?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onStartClick }) => {
  return (
    <header className="sticky top-0 z-50 bg-[#FAF8F5]/90 backdrop-blur-xl border-b border-[#D97706]/20 shadow-[0_4px_20px_rgba(217,119,6,0.06)]">
      <div className="h-20 max-w-7xl mx-auto px-6 flex items-center justify-between gap-4">
        
        {/* Logo & Branding */}
        <div className="group flex items-center gap-3 shrink-0 cursor-pointer" onClick={onStartClick}>
          <div className="w-10 h-10 bg-[#F5EFEB] text-[#B45309] flex items-center justify-center rounded-lg border border-[#D97706]/40 shadow-sm group-hover:border-[#B45309] group-hover:shadow-[0_0_12px_rgba(217,119,6,0.25)] group-hover:scale-105 transition-all duration-200">
            <Gavel className="w-5 h-5 text-[#B45309] group-hover:-rotate-45 transition-transform duration-200" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-headline text-lg uppercase tracking-wider text-[#1C1917] font-black group-hover:text-[#B45309] transition-colors duration-200">
                PITCH·ARENA
              </span>
              <span className="font-pixel text-[9px] px-1.5 py-0.5 rounded bg-[#FEF3C7] text-[#92400E] border border-[#F59E0B]/50 font-bold">
                AI VOXEL
              </span>
            </div>
            <span className="font-mono text-[#78716C] uppercase tracking-widest text-[9px] font-bold">
              REALTIME AI VOICE DEFENSE STUDIO
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-3">
          <button
            type="button"
            onClick={onStartClick}
            className="px-3.5 py-1.5 font-mono text-xs font-bold bg-[#F5EFEB] text-[#92400E] rounded-md border border-[#D97706]/40 uppercase tracking-wider hover:bg-[#FEF3C7] hover:border-[#B45309] hover:shadow-[0_0_12px_rgba(217,119,6,0.2)] transition-all duration-150 cursor-pointer"
          >
            [ VÀO ĐẤU TRƯỜNG ]
          </button>
          <a
            href="#jury-council"
            className="px-3.5 py-1.5 font-mono text-xs text-[#57534E] hover:text-[#B45309] font-bold uppercase transition-colors duration-150"
          >
            HỘI ĐỒNG GIÁM KHẢO
          </a>
          <a
            href="#subsystems"
            className="px-3.5 py-1.5 font-mono text-xs text-[#57534E] hover:text-[#B45309] font-bold uppercase transition-colors duration-150"
          >
            HỆ THỐNG CỐT LÕI
          </a>
        </nav>

        {/* Action Button */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onStartClick}
            className="font-pixel text-xs bg-[#D97706] hover:bg-[#B45309] text-white font-bold px-4 py-2.5 rounded-lg uppercase tracking-wider border border-[#D97706] shadow-[0_4px_14px_rgba(217,119,6,0.3)] hover:shadow-[0_6px_20px_rgba(217,119,6,0.4)] active:translate-y-0.5 transition-all inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>[ BẮT ĐẦU ]</span>
          </button>
        </div>

      </div>
    </header>
  );
};
