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
              Hội Đồng 4 Trụ Cột Thẩm Định Khắc Nghiệt
            </h2>
          </div>
          <p className="font-sans text-xs text-neutral-600 max-w-md">
            Mỗi Giám khảo phụ trách độc lập 1 trong 4 nhóm câu hỏi then chốt: Thị trường, Công nghệ, Tài chính, và Rủi ro dài hạn.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          
          {/* Boss 1: Thị Trường */}
          <div className="group cursor-pointer select-none bg-surface-container-low hover:bg-white border-2 border-black p-4 rounded-lg arcade-shadow-sm hover:arcade-shadow hover:-translate-y-1.5 transition-all duration-200 flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 bg-black text-white font-mono text-[9px] rounded font-bold uppercase flex items-center gap-1 group-hover:scale-105 transition-transform duration-200">
                  <TrendingUp className="w-3 h-3 text-rose-400" />
                  MARKET SHARK
                </span>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-black/20 text-neutral-600 group-hover:bg-black group-hover:text-white font-bold transition-colors duration-200">
                  LV.98
                </span>
              </div>
              <h3 className="font-headline text-base font-bold text-black mt-2.5">
                Shark Trần Nam
              </h3>
              <span className="font-mono text-[10px] text-neutral-600 block uppercase font-bold">
                1. Vấn đề & Thị trường
              </span>
              <p className="font-sans text-[11px] text-neutral-700 mt-2 leading-relaxed">
                Truy vấn nỗi đau thực tế của khách hàng, cơ sở khảo sát người dùng, và bằng chứng khách hàng sẵn sàng chi tiền.
              </p>
            </div>
            <div className="pt-2 border-t border-black/10 font-mono text-[10px] text-neutral-500 font-bold flex items-center justify-between group-hover:text-black transition-colors duration-200">
              <span>TRỌNG TÂM: NHU CẦU THỰC</span>
              <span className="text-black uppercase">NHÓM 1</span>
            </div>
          </div>

          {/* Boss 2: Công Nghệ */}
          <div className="group cursor-pointer select-none bg-surface-container-low hover:bg-white border-2 border-black p-4 rounded-lg arcade-shadow-sm hover:arcade-shadow hover:-translate-y-1.5 transition-all duration-200 flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 bg-neutral-300 text-neutral-900 group-hover:bg-black group-hover:text-white font-mono text-[9px] rounded font-bold uppercase flex items-center gap-1 transition-colors duration-200">
                  <Cpu className="w-3 h-3 text-cyan-400 group-hover:rotate-12 transition-transform duration-200" />
                  AI SENTINEL
                </span>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-black/20 text-neutral-600 group-hover:bg-black group-hover:text-white font-bold transition-colors duration-200">
                  LV.92
                </span>
              </div>
              <h3 className="font-headline text-base font-bold text-black mt-2.5">
                TS. Lê Minh Trang
              </h3>
              <span className="font-mono text-[10px] text-neutral-600 block uppercase font-bold">
                2. Sản phẩm & Công nghệ
              </span>
              <p className="font-sans text-[11px] text-neutral-700 mt-2 leading-relaxed">
                Soi xét kiến trúc MVP, độ trễ phản hồi, tính độc quyền công nghệ lõi và cơ chế xử lý khi mô hình AI trả lời sai.
              </p>
            </div>
            <div className="pt-2 border-t border-black/10 font-mono text-[10px] text-neutral-500 font-bold flex items-center justify-between group-hover:text-black transition-colors duration-200">
              <span>TRỌNG TÂM: TECH CORE</span>
              <span className="text-black uppercase">NHÓM 2</span>
            </div>
          </div>

          {/* Boss 3: Tài Chính */}
          <div className="group cursor-pointer select-none bg-surface-container-low hover:bg-white border-2 border-black p-4 rounded-lg arcade-shadow-sm hover:arcade-shadow hover:-translate-y-1.5 transition-all duration-200 flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 bg-neutral-300 text-neutral-900 group-hover:bg-black group-hover:text-white font-mono text-[9px] rounded font-bold uppercase flex items-center gap-1 transition-colors duration-200">
                  <Flame className="w-3 h-3 text-amber-400 animate-pulse" />
                  FINANCE DRAGON
                </span>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-black/20 text-neutral-600 group-hover:bg-black group-hover:text-white font-bold transition-colors duration-200">
                  LV.95
                </span>
              </div>
              <h3 className="font-headline text-base font-bold text-black mt-2.5">
                GS. Vũ Hoàng
              </h3>
              <span className="font-mono text-[10px] text-neutral-600 block uppercase font-bold">
                3. Mô hình KD & Tài chính
              </span>
              <p className="font-sans text-[11px] text-neutral-700 mt-2 leading-relaxed">
                Bóc tách chi phí sản xuất, giá bán thực tế, lãi trên từng sản phẩm, điểm hòa vốn và nguồn vốn duy trì đội ngũ.
              </p>
            </div>
            <div className="pt-2 border-t border-black/10 font-mono text-[10px] text-neutral-500 font-bold flex items-center justify-between group-hover:text-black transition-colors duration-200">
              <span>TRỌNG TÂM: LÃI/LỖ & DÒNG TIỀN</span>
              <span className="text-black uppercase">NHÓM 3</span>
            </div>
          </div>

          {/* Boss 4: Rủi Ro & Lộ Trình */}
          <div className="group cursor-pointer select-none bg-surface-container-low hover:bg-white border-2 border-black p-4 rounded-lg arcade-shadow-sm hover:arcade-shadow hover:-translate-y-1.5 transition-all duration-200 flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 bg-neutral-300 text-neutral-900 group-hover:bg-black group-hover:text-white font-mono text-[9px] rounded font-bold uppercase flex items-center gap-1 transition-colors duration-200">
                  <Users className="w-3 h-3 text-purple-400" />
                  RISK STRATEGIST
                </span>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-black/20 text-neutral-600 group-hover:bg-black group-hover:text-white font-bold transition-colors duration-200">
                  LV.94
                </span>
              </div>
              <h3 className="font-headline text-base font-bold text-black mt-2.5">
                ThS. Đặng Mai Lan
              </h3>
              <span className="font-mono text-[10px] text-neutral-600 block uppercase font-bold">
                4. Rủi ro & Kế hoạch tương lai
              </span>
              <p className="font-sans text-[11px] text-neutral-700 mt-2 leading-relaxed">
                Bắt bẻ kịch bản bị đối thủ lớn sao chép, rào cản phòng thủ dài hạn, và tính khả thi của lộ trình triển khai 6-12 tháng.
              </p>
            </div>
            <div className="pt-2 border-t border-black/10 font-mono text-[10px] text-neutral-500 font-bold flex items-center justify-between group-hover:text-black transition-colors duration-200">
              <span>TRỌNG TÂM: PHÒNG THỦ & ROADMAP</span>
              <span className="text-black uppercase">NHÓM 4</span>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
