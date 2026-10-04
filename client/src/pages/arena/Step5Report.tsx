import React from 'react';
import { DocumentAnalysisResult } from '@pitcharena/shared';
import { RotateCcw, Play } from 'lucide-react';

interface Step5ReportProps {
  documentData: DocumentAnalysisResult | null;
  onResetToStep1: () => void;
  onRematch: () => void;
}

export const Step5Report: React.FC<Step5ReportProps> = ({
  documentData,
  onResetToStep1,
  onRematch,
}) => {
  return (
    <div className="flex flex-col gap-6 animate-fadeIn">
      {/* Header Báo cáo */}
      <div className="border-2 border-black bg-white p-5 shadow-[4px_4px_0px_#000] flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="font-mono text-xs font-bold bg-black text-white px-2 py-0.5">
            BƯỚC 05 // TỔNG KẾT & PHÚC KHẢO ĐỀ TÀI
          </span>
          <h2 className="font-headline text-2xl font-black text-black tracking-tight mt-1">
            BÁO CÁO PHỤ LỤC CHẨN ĐOÁN (ACTIONABLE APPENDIX)
          </h2>
          <p className="font-sans text-xs text-neutral-600 mt-0.5">
            Tổng hợp đối chiếu 3 cột: Lỗ hổng bị bóc mẽ, ngụy biện logic và phương án điều chỉnh slide trước giờ G.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRematch}
            className="px-4 py-2 bg-black text-white font-mono text-xs font-bold border-2 border-black shadow-[3px_3px_0px_#eab308] hover:bg-neutral-800 active:translate-x-0.5 active:translate-y-0.5 flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            [ ↺ TÁI ĐẤU LẬP TỨC ]
          </button>
        </div>
      </div>

      {/* 3-Column Diagnostic Table */}
      <div className="border-2 border-black bg-white shadow-[4px_4px_0px_#000] overflow-x-auto font-mono text-xs">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-black text-white border-b-2 border-black text-[11px]">
              <th className="p-3 border-r border-neutral-700 w-3/12">
                1. CÂU HỎI HỘI ĐỒNG
              </th>
              <th className="p-3 border-r border-neutral-700 w-4/12 text-rose-300">
                2. LỖ HỔNG / LỖI LOGIC PHÁT HIỆN
              </th>
              <th className="p-3 w-5/12 text-emerald-300">
                3. HƯỚNG ĐIỀU CHỈNH SLIDE & CÂU TRẢ LỜI
              </th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-black font-sans text-xs">
            <tr className="hover:bg-neutral-50">
              <td className="p-3.5 border-r border-black font-mono font-bold align-top">
                <span className="text-neutral-500 block text-[10px]">GS. VŨ HOÀNG:</span>
                Chi phí API LLM leo thang có thể làm âm dòng tiền trong 6 tháng đầu.
              </td>
              <td className="p-3.5 border-r border-black text-neutral-800 align-top bg-rose-50/40">
                <strong className="text-rose-600 block mb-1 font-mono text-[11px]">
                  LỖI: THIẾU UNIT ECONOMICS TOÀN PHẦN
                </strong>
                Thí sinh trả lời chung chung "sẽ gọi vốn thiên thần" thay vì chứng minh giải pháp kỹ thuật giảm chi phí token.
              </td>
              <td className="p-3.5 text-neutral-800 align-top bg-emerald-50/40">
                <strong className="text-emerald-700 block mb-1 font-mono text-[11px]">
                  HƯỚNG SỬA TRÊN SLIDE:
                </strong>
                Bổ sung slide "Kiến trúc Tối ưu Chi phí": Áp dụng Semantic Caching và mô hình SLM chạy On-Premise giúp giảm 70% chi phí gọi cloud API.
              </td>
            </tr>

            <tr className="hover:bg-neutral-50">
              <td className="p-3.5 border-r border-black font-mono font-bold align-top">
                <span className="text-neutral-500 block text-[10px]">SHARK TRẦN NAM:</span>
                Rào cản phòng thủ (Moat) trước đối thủ Big Tech sao chép tính năng.
              </td>
              <td className="p-3.5 border-r border-black text-neutral-800 align-top bg-rose-50/40">
                <strong className="text-rose-600 block mb-1 font-mono text-[11px]">
                  LỖI: NGỤY BIỆN ĐI ĐẦU THỊ TRƯỜNG
                </strong>
                Khẳng định "chúng tôi là người đầu tiên tại Việt Nam", thiếu dữ liệu về rào cản chuyển đổi (Switching Cost).
              </td>
              <td className="p-3.5 text-neutral-800 align-top bg-emerald-50/40">
                <strong className="text-emerald-700 block mb-1 font-mono text-[11px]">
                  HƯỚNG SỬA TRÊN SLIDE:
                </strong>
                Nhấn mạnh thỏa thuận chia sẻ dữ liệu độc quyền 5 năm với 3 chuỗi phòng khám và chuẩn tích hợp sâu vào hệ thống quản lý có sẵn.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Bottom Actions */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onResetToStep1}
          className="px-3 py-2 border-2 border-black font-mono text-xs font-bold hover:bg-neutral-100 flex items-center gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          NẠP ĐỀ TÀI KHÁC (BƯỚC 01)
        </button>

        <button
          type="button"
          onClick={onRematch}
          className="px-5 py-2.5 bg-black text-white font-mono font-bold text-xs border-2 border-black shadow-[3px_3px_0px_#eab308] hover:bg-neutral-800 active:translate-x-0.5 active:translate-y-0.5 flex items-center gap-2"
        >
          <Play className="w-4 h-4 fill-amber-400 text-amber-400" />
          <span>BẮT ĐẦU VÒNG TÁI ĐẤU MỚI (BƯỚC 02)</span>
        </button>
      </div>
    </div>
  );
};
export const Step4Report = Step5Report;
