import React from 'react';
import { Gavel, Play, Radio, Cpu } from 'lucide-react';

interface NavbarProps {
  onStartClick?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onStartClick }) => {
  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b-2 border-black shadow-[0_1px_6px_rgba(0,0,0,0.06)]">
      <div className="h-20 max-w-7xl mx-auto px-6 flex items-center justify-between gap-4">
        
        {/* Logo & Branding */}
        <div className="group flex items-center gap-3 shrink-0 cursor-pointer">
          <div className="w-10 h-10 bg-black text-white flex items-center justify-center rounded border-2 border-black arcade-shadow-sm group-hover:scale-105 transition-all duration-200">
            <Gavel className="w-5 h-5 text-white group-hover:-rotate-45 transition-transform duration-200" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-headline text-lg uppercase tracking-wider text-black font-bold group-hover:tracking-widest transition-all duration-200">
                PITCH·ARENA
              </span>
            </div>
            <span className="font-mono text-neutral-500 uppercase tracking-widest text-[9px]">
              REALTIME AI VOICE DEFENSE STUDIO
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-2">
          <a
            href="#uploader"
            className="px-3 py-1.5 font-mono text-xs font-bold bg-black text-white rounded uppercase tracking-wider hover:bg-neutral-800 arcade-shadow-sm transition-all duration-150"
          >
            [ NẠP ĐỀ TÀI ]
          </a>
          <a
            href="#jury-council"
            className="px-3 py-1.5 font-mono text-xs text-neutral-600 hover:text-black font-bold uppercase transition-colors duration-150"
          >
            HỘI ĐỒNG GIÁM KHẢO
          </a>
          <a
            href="#subsystems"
            className="px-3 py-1.5 font-mono text-xs text-neutral-600 hover:text-black font-bold uppercase transition-colors duration-150"
          >
            HỆ THỐNG CỐT LÕI
          </a>
        </nav>

        {/* Action Button */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onStartClick}
            className="font-mono text-xs bg-black hover:bg-neutral-800 active:translate-y-0.5 active:translate-x-0.5 text-white font-bold px-4 py-2 rounded uppercase tracking-wider border-2 border-black arcade-shadow arcade-shadow-hover transition-all inline-flex items-center gap-1.5"
          >
            <Play className="w-3.5 h-3.5" />
            <span>[ &gt; BẮT ĐẦU ]</span>
          </button>
        </div>

      </div>
    </header>
  );
};
