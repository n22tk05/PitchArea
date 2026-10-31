import React from 'react';
import { DocumentAnalysisResult } from '@pitcharena/shared';
import { Sparkles } from 'lucide-react';
import { DocumentUploader } from '../../components/DocumentUploader';

interface Step1UploadProps {
  documentData: DocumentAnalysisResult | null;
  onDocumentAnalyzed: (result: DocumentAnalysisResult) => void;
  onNext: () => void;
  onReset: () => void;
  onUseDemo: () => void;
}

export const Step1Upload: React.FC<Step1UploadProps> = ({
  documentData,
  onDocumentAnalyzed,
  onNext,
  onReset,
  onUseDemo,
}) => {
  return (
    <div className="flex flex-col gap-6 animate-fadeIn">
      {/* Banner Tiêu đề Bước 01 */}
      <div className="p-6 rounded-2xl bg-[#FAF8F5] border border-[#D97706]/30 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="font-pixel text-[10px] font-bold bg-[#FEF3C7] text-[#92400E] px-2.5 py-1 rounded-full border border-[#F59E0B]/50 inline-block shadow-xs">
            BƯỚC 01 // KHỞI TẠO DỮ LIỆU
          </span>
          <h2 className="font-headline text-2xl font-black text-[#1C1917] tracking-tight mt-2">
            NẠP TÀI LIỆU THUYẾT MINH (.DOCX)
          </h2>
          <p className="font-sans text-xs text-[#57534E] mt-1">
            Hệ thống tự động lọc bỏ hình ảnh rác, bóc tách 5 khối chuyên môn và nhận diện 3 điểm mù rủi ro.
          </p>
        </div>

        {!documentData && (
          <button
            type="button"
            onClick={onUseDemo}
            className="px-4 py-2.5 bg-[#FEF3C7] hover:bg-[#FDE68A] text-[#92400E] font-pixel text-xs font-bold border border-[#F59E0B]/60 rounded-xl shadow-xs active:translate-x-0.5 active:translate-y-0.5 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4 fill-[#92400E]" />
            <span>[ THỬ NGHIỆM VỚI ĐỀ TÀI MẪU ]</span>
          </button>
        )}
      </div>

      {/* Component Uploader kèm Danh sách 5 khối đề mục kinh doanh nằm cạnh bên */}
      <DocumentUploader
        value={documentData}
        onAnalysisComplete={onDocumentAnalyzed}
        onNext={onNext}
        onReset={onReset}
      />
    </div>
  );
};
