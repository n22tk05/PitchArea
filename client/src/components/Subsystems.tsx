import React from 'react';
import { Layers, Mic, Heart, Shield } from 'lucide-react';

export const Subsystems: React.FC = () => {
  return (
    <section id="subsystems" className="w-full py-16 border-t-2 border-black">
      <div className="max-w-7xl mx-auto px-6 flex flex-col gap-8">
        
        <div>
          <span className="font-mono text-xs text-neutral-500 uppercase font-bold tracking-widest">
            TACTICAL ARCHITECTURE
          </span>
          <h2 className="font-headline text-2xl md:text-3xl font-bold text-black mt-1">
            4 Vũ Khí Công Nghệ Cốt Lõi
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          <div className="group cursor-pointer select-none bg-white border-2 border-black p-5 rounded-lg flex flex-col justify-between gap-4 arcade-shadow-sm hover:arcade-shadow hover:-translate-y-1.5 transition-all duration-200">
            <div className="flex flex-col gap-3">
              <div className="w-10 h-10 rounded bg-black text-white flex items-center justify-center arcade-shadow-sm group-hover:scale-105 group-hover:-rotate-3 transition-all duration-200">
                <Layers className="w-5 h-5 text-white" />
              </div>
              <span className="font-mono text-[10px] text-neutral-500 uppercase font-bold group-hover:text-neutral-700 transition-colors duration-200">
                NESTJS IN-MEMORY RAG
              </span>
              <h3 className="font-headline text-base font-bold text-black group-hover:translate-x-0.5 transition-transform duration-200">
                Bóc Tách 5 Khối Chuyên Môn
              </h3>
              <p className="font-sans text-xs text-neutral-600 leading-relaxed">
                Tự động loại bỏ ảnh chụp màn hình rác, bóc tách trực tiếp số liệu vào bảng Whitelist để đối soát chính xác câu trả lời.
              </p>
            </div>
            <span className="font-mono text-[10px] text-neutral-500 group-hover:text-black font-bold border-t border-black/10 pt-2 flex items-center justify-between transition-colors duration-200">
              <span className="flex items-center gap-1">
                <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-150">▶</span>
                <span>100% CLEAN TEXT</span>
              </span>
              <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-150">→</span>
            </span>
          </div>

          <div className="group cursor-pointer select-none bg-white border-2 border-black p-5 rounded-lg flex flex-col justify-between gap-4 arcade-shadow-sm hover:arcade-shadow hover:-translate-y-1.5 transition-all duration-200">
            <div className="flex flex-col gap-3">
              <div className="w-10 h-10 rounded bg-black text-white flex items-center justify-center arcade-shadow-sm group-hover:scale-105 group-hover:-rotate-3 transition-all duration-200">
                <Mic className="w-5 h-5 text-white" />
              </div>
              <span className="font-mono text-[10px] text-neutral-500 uppercase font-bold group-hover:text-neutral-700 transition-colors duration-200">
                VOICE & VAD ENGINE
              </span>
              <h3 className="font-headline text-base font-bold text-black group-hover:translate-x-0.5 transition-transform duration-200">
                Phản Hồi Nhanh
              </h3>
              <p className="font-sans text-xs text-neutral-600 leading-relaxed">
                Nhận diện giọng nói STT qua WebRTC. Bắt khoảng lặng ngập ngừng 2.0s để Boss Giám khảo can thiệp khi thí sinh lúng túng.
              </p>
            </div>
            <span className="font-mono text-[10px] text-neutral-500 group-hover:text-black font-bold border-t border-black/10 pt-2 flex items-center justify-between transition-colors duration-200">
              <span className="flex items-center gap-1">
                <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-150">▶</span>
                <span>SILENCE WINDOW: 2.0s</span>
              </span>
              <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-150">→</span>
            </span>
          </div>

          <div className="group cursor-pointer select-none bg-white border-2 border-black p-5 rounded-lg flex flex-col justify-between gap-4 arcade-shadow-sm hover:arcade-shadow hover:-translate-y-1.5 transition-all duration-200">
            <div className="flex flex-col gap-3">
              <div className="w-10 h-10 rounded bg-black text-white flex items-center justify-center arcade-shadow-sm group-hover:scale-105 group-hover:-rotate-3 transition-all duration-200">
                <Heart className="w-5 h-5 text-white group-hover:text-rose-400 transition-colors duration-200" />
              </div>
              <span className="font-mono text-[10px] text-neutral-500 uppercase font-bold group-hover:text-neutral-700 transition-colors duration-200">
                GAME MECHANICS
              </span>
              <h3 className="font-headline text-base font-bold text-black group-hover:translate-x-0.5 transition-transform duration-200">
                Thanh Máu Đối Kháng
              </h3>
              <p className="font-sans text-xs text-neutral-600 leading-relaxed">
                Phạt trừ -15% máu khi thí sinh viện dẫn sai số liệu hoặc ngụy biện, kèm âm thanh retro và hiệu ứng giật nảy màn hình.
              </p>
            </div>
            <span className="font-mono text-[10px] text-neutral-500 group-hover:text-black font-bold border-t border-black/10 pt-2 flex items-center justify-between transition-colors duration-200">
              <span className="flex items-center gap-1">
                <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-150">▶</span>
                <span>PENALTY: -15% HP / LỖI</span>
              </span>
              <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-150">→</span>
            </span>
          </div>

          <div className="group cursor-pointer select-none bg-white border-2 border-black p-5 rounded-lg flex flex-col justify-between gap-4 arcade-shadow-sm hover:arcade-shadow hover:-translate-y-1.5 transition-all duration-200">
            <div className="flex flex-col gap-3">
              <div className="w-10 h-10 rounded bg-black text-white flex items-center justify-center arcade-shadow-sm group-hover:scale-105 group-hover:-rotate-3 transition-all duration-200">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <span className="font-mono text-[10px] text-neutral-500 uppercase font-bold group-hover:text-neutral-700 transition-colors duration-200">
                PEDAGOGICAL SHIELD
              </span>
              <h3 className="font-headline text-base font-bold text-black group-hover:translate-x-0.5 transition-transform duration-200">
                Khiên trợ thủ
              </h3>
              <p className="font-sans text-xs text-neutral-600 leading-relaxed">
                Khóa sinh lực ở mức 20% tối thiểu, đảm bảo sinh viên luôn có cơ hội bảo vệ trọn vẹn đề tài để nhận góp ý quý giá từ hội đồng.
              </p>
            </div>
            <span className="font-mono text-[10px] text-neutral-500 group-hover:text-black font-bold border-t border-black/10 pt-2 flex items-center justify-between transition-colors duration-200">
              <span className="flex items-center gap-1">
                <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-150">▶</span>
                <span>SAFEGUARD: 20% FLOOR</span>
              </span>
              <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-150">→</span>
            </span>
          </div>

        </div>

      </div>
    </section>
  );
};
