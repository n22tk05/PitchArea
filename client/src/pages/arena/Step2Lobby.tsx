import React from 'react';
import { DocumentAnalysisResult, LobbyConfig as LobbyConfigType } from '@pitcharena/shared';
import { AlertTriangle, Sparkles } from 'lucide-react';
import { LobbyConfig } from '../../components/LobbyConfig';

interface Step2LobbyProps {
  documentData: DocumentAnalysisResult | null;
  onBack: () => void;
  onNext: (config?: LobbyConfigType) => void;
  onUseDemo: () => void;
}

export const Step2Lobby: React.FC<Step2LobbyProps> = ({
  documentData,
  onBack,
  onNext,
  onUseDemo,
}) => {
  return (
    <div className="flex flex-col gap-6 animate-fadeIn">
      {documentData ? (
        <LobbyConfig
          documentData={documentData}
          onBackToUpload={onBack}
          onStartCombat={onNext}
        />
      ) : (
        <div className="rounded-2xl border border-[#D97706]/30 bg-[#FFFFFF] p-8 text-center flex flex-col items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-[#FEF3C7] border border-[#D97706]/35 flex items-center justify-center text-[#B45309]">
            <AlertTriangle className="w-6 h-6 text-[#D97706]" />
          </div>
          <h3 className="font-headline font-bold text-lg text-[#1C1917]">Chưa có dữ liệu đề tài</h3>
          <p className="text-xs text-[#57534E] max-w-md font-sans">
            Vui lòng hoàn thành Bước 01 hoặc bấm nút bên dưới để nạp đề tài mẫu khởi nghiệp AI.
          </p>
          <button
            type="button"
            onClick={onUseDemo}
            className="px-5 py-2.5 bg-[#FEF3C7] hover:bg-[#FDE68A] border border-[#F59E0B]/60 text-[#92400E] font-pixel text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 cursor-pointer transition-all"
          >
            <Sparkles className="w-4 h-4 fill-[#92400E]" />
            <span>NẠP ĐỀ TÀI MẪU NGAY</span>
          </button>
        </div>
      )}
    </div>
  );
};
