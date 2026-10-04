import React from 'react';
import { DocumentAnalysisResult } from '@pitcharena/shared';
import { ArrowLeft, ArrowRight, AlertTriangle } from 'lucide-react';
import { LobbyConfig } from '../../components/LobbyConfig';

interface Step2LobbyProps {
  documentData: DocumentAnalysisResult | null;
  onBack: () => void;
  onNext: () => void;
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
        <>
          <LobbyConfig
            documentData={documentData}
            onBackToUpload={onBack}
            onStartCombat={onNext}
          />
        </>
      ) : (
        <div className="border-2 border-black bg-white p-8 text-center flex flex-col items-center gap-4 shadow-[4px_4px_0px_#000]">
          <AlertTriangle className="w-10 h-10 text-amber-500" />
          <h3 className="font-bold text-lg">Chưa có dữ liệu đề tài</h3>
          <p className="text-xs text-neutral-600 max-w-md font-sans">
            Vui lòng hoàn thành Bước 01 hoặc bấm nút bên dưới để nạp đề tài mẫu khởi nghiệp AI.
          </p>
          <button
            type="button"
            onClick={onUseDemo}
            className="px-4 py-2 bg-amber-400 border-2 border-black font-mono text-xs font-bold shadow-[2px_2px_0px_#000]"
          >
            NẠP ĐỀ TÀI MẪU NGAY
          </button>
        </div>
      )}
    </div>
  );
};
