import React from 'react';
import { Gavel, Heart } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-white border-t-2 border-black py-8">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 font-mono text-xs text-neutral-600 font-bold">
        <div className="group flex items-center gap-2 cursor-default select-none">
          <Gavel className="w-4 h-4 text-black group-hover:-rotate-12 transition-transform duration-200" />
          <span className="text-black uppercase group-hover:tracking-wider transition-all duration-200">
            PITCH·ARENA STUDIO // NESTJS & REACTJS ARCHITECTURE
          </span>
        </div>
        <div className="flex items-center gap-4 text-neutral-500">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
            <span>STYLED WITH TAILWIND CSS & LUCIDE REACT</span>
          </span>
          <span>•</span>
          <span className="text-black">2026 UNIVERSITY EDITION</span>
        </div>
      </div>
    </footer>
  );
};
