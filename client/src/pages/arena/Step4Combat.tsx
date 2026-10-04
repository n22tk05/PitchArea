import React from 'react';
import { DocumentAnalysisResult } from '@pitcharena/shared';
import { ArrowLeft, ArrowRight } from 'lucide-react';

interface Step4CombatProps {
  documentData: DocumentAnalysisResult | null;
  onBack: () => void;
  onNext: () => void;
}

export const Step4Combat: React.FC<Step4CombatProps> = ({
  documentData,
  onBack,
  onNext,
}) => {
  return (
    <div className="flex flex-col gap-6 animate-fadeIn">
      {/* Arena Stage Viewport */}
      <div className="border-2 border-black bg-white p-6 shadow-[6px_6px_0px_#000] flex flex-col gap-6">
        {/* Header Status Bar */}
        <div className="flex items-center justify-between pb-3 border-b-2 border-black">
          <div className="flex items-center gap-2">
            <span className="bg-rose-600 text-white font-mono text-xs font-bold px-2 py-0.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              BƯỚC 04 // ĐỐI CHẤT PHẢN BIỆN (COMBAT ARENA)
            </span>
            <span className="font-mono text-xs font-bold text-neutral-600">
              BOSS: GS. VŨ HOÀNG [LV.95]
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 border border-emerald-300">
              SÀN BẢO VỆ TÂN THỦ: 20% HP
            </span>
            <button
              type="button"
              onClick={onNext}
              className="px-3 py-1 bg-black text-white font-mono text-xs font-bold hover:bg-neutral-800"
            >
              KẾT THÚC LƯỢT →
            </button>
          </div>
        </div>

        {/* Arena Visualizer Box */}
        <div className="relative w-full h-72 bg-neutral-900 border-2 border-black p-5 flex flex-col justify-between overflow-hidden text-white font-mono">
          {/* CRT Scanline */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] pointer-events-none opacity-40" />

          <div className="relative z-10 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-amber-400 font-bold">GIÁM KHẢO CHẤT VẤN:</span>
              <span>GS. Vũ Hoàng (Finance Dragon)</span>
            </div>
            <div className="text-rose-400 font-bold">ĐỒNG HỒ ÁP LỰC: 00:24</div>
          </div>

          {/* Boss Dialogue Question */}
          <div className="relative z-10 my-auto p-4 border border-neutral-700 bg-neutral-950/80">
            <p className="text-amber-300 text-sm leading-relaxed">
              "Trong tài liệu trang 4, bạn công bố CAC là 3.2 triệu và LTV 48 triệu VNĐ. Tuy nhiên với mô hình LLM API chạy real-time cho 120 phòng khám, chi phí token suy luận ước tính ngốn hơn 60% doanh thu. Bạn dự phòng dòng tiền cạn kiệt trong 6 tháng đầu thế nào?"
            </p>
          </div>

          {/* Candidate Voice Activity Detection Status */}
          <div className="relative z-10 flex items-center justify-between text-[11px] text-neutral-400 border-t border-neutral-800 pt-2">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              VAD: CANDIDATE IS DEFENDING (SPEAKING...)
            </span>
            <span>THANH MÁU: 85% HP</span>
          </div>
        </div>

        {/* Step 4 Navigation Controls */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={onBack}
            className="px-3 py-2 border-2 border-black font-mono text-xs font-bold hover:bg-neutral-100 flex items-center gap-1.5 active:translate-x-0.5 active:translate-y-0.5 shadow-[2px_2px_0px_#000]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>PITCHING (BƯỚC 03)</span>
          </button>

          <button
            type="button"
            onClick={onNext}
            className="px-5 py-2.5 bg-black text-white font-mono font-bold text-xs border-2 border-black shadow-[3px_3px_0px_#eab308] hover:bg-neutral-800 active:translate-x-0.5 active:translate-y-0.5 flex items-center gap-2"
          >
            <span>XEM BÁO CÁO PHỤ LỤC (BƯỚC 05)</span>
            <ArrowRight className="w-4 h-4 text-amber-400" />
          </button>
        </div>
      </div>
    </div>
  );
};
export const Step3Combat = Step4Combat;
