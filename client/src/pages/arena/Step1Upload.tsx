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
      <div className="border-2 border-black bg-white p-5 shadow-[4px_4px_0px_#000] flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="font-mono text-xs font-bold bg-black text-white px-2 py-0.5">
            BƯỚC 01 // KHỞI TẠO DỮ LIỆU
          </span>
          <h2 className="font-headline text-2xl font-black text-black tracking-tight mt-1">
            NẠP TÀI LIỆU THUYẾT MINH (.DOCX)
          </h2>
          <p className="font-sans text-xs text-neutral-600 mt-0.5">
            Hệ thống tự động lọc bỏ hình ảnh rác, bóc tách 5 khối chuyên môn và nhận diện 3 điểm mù rủi ro.
          </p>
        </div>

        {!documentData && (
          <button
            type="button"
            onClick={onUseDemo}
            className="px-3.5 py-2 bg-amber-400 border-2 border-black font-mono text-xs font-bold shadow-[3px_3px_0px_#000] hover:bg-amber-300 active:translate-x-0.5 active:translate-y-0.5 flex items-center gap-1.5"
          >
            <Sparkles className="w-4 h-4 fill-black" />
            [ THỬ NGHIỆM VỚI ĐỀ TÀI MẪU ]
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
