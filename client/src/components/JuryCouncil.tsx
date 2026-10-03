import React from 'react';
import { Flame, Cpu, TrendingUp, Users } from 'lucide-react';

export const JuryCouncil: React.FC = () => {
  return (
    <section id="jury-council" className="w-full bg-white py-16 border-t-2 border-black">
      <div className="max-w-7xl mx-auto px-6 flex flex-col gap-8">
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-black font-mono text-xs uppercase font-bold tracking-widest">
              <Users className="w-4 h-4" />
              <span>THE COUNCIL ARCHITECTURE</span>
            </div>
            <h2 className="font-headline text-2xl md:text-3xl font-bold text-black mt-1">
              Hội Đồng 3 Boss Giám Khảo Khắc Nghiệt
            </h2>
          </div>
          <p className="font-sans text-xs text-neutral-600 max-w-md">
            Áp dụng cơ chế Solo Boss: Chỉ một giám khảo chất vấn dồn dập tại một thời điểm, loại bỏ tranh lời và gia tăng kịch tính phòng thi.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Boss 1 */}
          <div className="group cursor-pointer select-none bg-surface-container-low hover:bg-white border-2 border-black p-5 rounded-lg arcade-shadow-sm hover:arcade-shadow hover:-translate-y-1.5 transition-all duration-200 flex flex-col justify-between gap-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 bg-black text-white font-mono text-[9px] rounded font-bold uppercase flex items-center gap-1 group-hover:scale-105 transition-transform duration-200">
                  <Flame className="w-3 h-3 text-amber-400 animate-pulse" />
                  FINANCE DRAGON
                </span>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-black/20 text-neutral-600 group-hover:bg-black group-hover:text-white font-bold transition-colors duration-200">
                  LV.95
                </span>
              </div>
              <h3 className="font-headline text-lg font-bold text-black mt-3 group-hover:translate-x-0.5 transition-transform duration-200">
                GS. Vũ Hoàng
              </h3>
              <span className="font-mono text-[10px] text-neutral-600 block uppercase font-bold">
                Khắc tinh Tài chính & CAC
              </span>
              <p className="font-sans text-xs text-neutral-700 mt-2 leading-relaxed">
                Soi xét mô hình dòng tiền, chi phí chuyển đổi khách hàng (CAC) so với giá trị trọn đời (LTV) và các giả định hòa vốn phi lý.
              </p>
            </div>
            <div className="pt-2 border-t border-black/10 font-mono text-[10px] text-neutral-500 font-bold flex items-center justify-between group-hover:text-black transition-colors duration-200">
              <span className="flex items-center gap-1">
                <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-150">▶</span>
                <span>TỶ LỆ PHẠT: -15% HP / LỖI</span>
              </span>
              <span className="text-black uppercase">CHUYÊN SÂU CAC</span>
            </div>
          </div>

          {/* Boss 2 */}
          <div className="group cursor-pointer select-none bg-surface-container-low hover:bg-white border-2 border-black p-5 rounded-lg arcade-shadow-sm hover:arcade-shadow hover:-translate-y-1.5 transition-all duration-200 flex flex-col justify-between gap-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 bg-neutral-300 text-neutral-900 group-hover:bg-black group-hover:text-white font-mono text-[9px] rounded font-bold uppercase flex items-center gap-1 transition-colors duration-200">
                  <Cpu className="w-3 h-3 group-hover:rotate-12 transition-transform duration-200" />
                  AI SENTINEL
                </span>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-black/20 text-neutral-600 group-hover:bg-black group-hover:text-white font-bold transition-colors duration-200">
                  LV.92
                </span>
              </div>
              <h3 className="font-headline text-lg font-bold text-black mt-3 group-hover:translate-x-0.5 transition-transform duration-200">
                TS. Lê Minh Trang
              </h3>
              <span className="font-mono text-[10px] text-neutral-600 block uppercase font-bold">
                Giám đốc Kỹ thuật & AI
              </span>
              <p className="font-sans text-xs text-neutral-700 mt-2 leading-relaxed">
                Soi xét chiều sâu công nghệ, độ trễ pipeline mô hình 220ms và giải pháp ngăn ngừa hiện tượng ảo giác dữ liệu (Hallucination).
              </p>
            </div>
            <div className="pt-2 border-t border-black/10 font-mono text-[10px] text-neutral-500 font-bold flex items-center justify-between group-hover:text-black transition-colors duration-200">
              <span className="flex items-center gap-1">
                <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-150">▶</span>
                <span>TỶ LỆ PHẠT: -15% HP / LỖI</span>
              </span>
              <span className="text-black uppercase">CHUYÊN SÂU TECH</span>
            </div>
          </div>

          {/* Boss 3 */}
          <div className="group cursor-pointer select-none bg-surface-container-low hover:bg-white border-2 border-black p-5 rounded-lg arcade-shadow-sm hover:arcade-shadow hover:-translate-y-1.5 transition-all duration-200 flex flex-col justify-between gap-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 bg-neutral-300 text-neutral-900 group-hover:bg-black group-hover:text-white font-mono text-[9px] rounded font-bold uppercase flex items-center gap-1 transition-colors duration-200">
                  <TrendingUp className="w-3 h-3 group-hover:translate-y-[-1px] group-hover:translate-x-[1px] transition-transform duration-200" />
                  MARKET SHARK
                </span>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-black/20 text-neutral-600 group-hover:bg-black group-hover:text-white font-bold transition-colors duration-200">
                  LV.98
                </span>
              </div>
              <h3 className="font-headline text-lg font-bold text-black mt-3 group-hover:translate-x-0.5 transition-transform duration-200">
                Shark Trần Nam
              </h3>
              <span className="font-mono text-[10px] text-neutral-600 block uppercase font-bold">
                Đầu tư mạo hiểm & GTM
              </span>
              <p className="font-sans text-xs text-neutral-700 mt-2 leading-relaxed">
                Bắt bẻ quy mô thị trường TAM/SAM/SOM, rào cản phòng thủ công nghệ (Moat) và tính khả thi trong chiến lược tiếp cận sinh viên.
              </p>
            </div>
            <div className="pt-2 border-t border-black/10 font-mono text-[10px] text-neutral-500 font-bold flex items-center justify-between group-hover:text-black transition-colors duration-200">
              <span className="flex items-center gap-1">
                <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-150">▶</span>
                <span>TỶ LỆ PHẠT: -15% HP / LỖI</span>
              </span>
              <span className="text-black uppercase">CHUYÊN SÂU GTM</span>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
