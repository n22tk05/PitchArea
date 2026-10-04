import React, { useState } from 'react';
import { DocumentAnalysisResult, LobbyConfig as LobbyConfigType } from '@pitcharena/shared';
import {
  ArrowLeft,
  FileUp,
  Sliders,
  Mic,
  Swords,
  FileSpreadsheet,
  Sparkles,
  Gavel,
} from 'lucide-react';
import {
  Step1Upload,
  Step2Lobby,
  Step3Pitching,
  Step4Combat,
  Step5Report,
  DEMO_PROJECT_DATA,
} from './arena';

// Re-export DEMO_PROJECT_DATA để giữ tương thích ngược
export { DEMO_PROJECT_DATA };

interface ArenaPageProps {
  initialStep?: 1 | 2 | 3 | 4 | 5;
  onBackToHome: () => void;
}

export const ArenaPage: React.FC<ArenaPageProps> = ({
  initialStep = 1,
  onBackToHome,
}) => {
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4 | 5>(initialStep);
  const [documentData, setDocumentData] =
    useState<DocumentAnalysisResult | null>(null);
  const [lobbyConfig, setLobbyConfig] = useState<LobbyConfigType | null>(null);
  const [pitchTranscript, setPitchTranscript] = useState<string>('');

  const steps = [
    {
      number: 1,
      title: 'NẠP DỮ LIỆU ĐỀ TÀI',
      sub: 'IN-MEMORY RAG',
      icon: FileUp,
    },
    {
      number: 2,
      title: 'SẢNH ĐẤU & VOICE LOBBY',
      sub: 'STREAMING 220MS',
      icon: Sliders,
    },
    {
      number: 3,
      title: 'THUYẾT MINH PITCHING',
      sub: 'LIVE SPEECH & WPM',
      icon: Mic,
    },
    {
      number: 4,
      title: 'PHẢN BIỆN ĐỐI CHẤT',
      sub: 'COMBAT ARENA',
      icon: Swords,
    },
    {
      number: 5,
      title: 'TỔNG HỢP & ĐÁNH GIÁ',
      sub: 'DIAGNOSTIC REPORT',
      icon: FileSpreadsheet,
    },
  ] as const;

  const handleDocumentAnalyzed = (result: DocumentAnalysisResult) => {
    setDocumentData(result);
  };

  const handleUseDemo = () => {
    handleDocumentAnalyzed(DEMO_PROJECT_DATA);
  };

  return (
    <div className="min-h-screen bg-neutral-100 text-black font-sans flex flex-col selection:bg-black selection:text-white">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-50 bg-white border-b-2 border-black shadow-[0_2px_0px_#000]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 cursor-pointer" onClick={onBackToHome}>
              <div className="w-8 h-8 bg-black text-white flex items-center justify-center border-2 border-black">
                <Gavel className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="font-headline font-black text-sm uppercase tracking-wider">
                  PITCH·ARENA STUDIO
                </span>
                <span className="font-mono text-[9px] text-neutral-500 tracking-tight">
                  PHÒNG ĐẤU TRƯỜNG PHẢN BIỆN CHUYÊN BIỆT
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!documentData && (
              <button
                type="button"
                onClick={handleUseDemo}
                className="px-2.5 py-1.5 bg-amber-400 border-2 border-black font-mono text-[11px] font-bold shadow-[2px_2px_0px_#000] hover:bg-amber-300 active:translate-x-0.5 active:translate-y-0.5 flex items-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5 fill-black" />
                [ DÙNG ĐỀ TÀI MẪU ]
              </button>
            )}
          </div>
        </div>

      
      </header>

      {/* Main Step Screen Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        {activeStep === 1 && (
          <Step1Upload
            documentData={documentData}
            onDocumentAnalyzed={handleDocumentAnalyzed}
            onNext={() => setActiveStep(2)}
            onReset={() => setDocumentData(null)}
            onUseDemo={handleUseDemo}
          />
        )}

        {activeStep === 2 && (
          <Step2Lobby
            documentData={documentData}
            onBack={() => setActiveStep(1)}
            onNext={(cfg) => {
              if (cfg) setLobbyConfig(cfg);
              setActiveStep(3);
            }}
            onUseDemo={handleUseDemo}
          />
        )}

        {activeStep === 3 && (
          <Step3Pitching
            documentData={documentData}
            lobbyConfig={lobbyConfig}
            onBack={() => setActiveStep(2)}
            onNext={(transcript) => {
              if (transcript) setPitchTranscript(transcript);
              setActiveStep(4);
            }}
          />
        )}

        {activeStep === 4 && (
          <Step4Combat
            documentData={documentData}
            onBack={() => setActiveStep(3)}
            onNext={() => setActiveStep(5)}
          />
        )}

        {activeStep === 5 && (
          <Step5Report
            documentData={documentData}
            onResetToStep1={() => setActiveStep(1)}
            onRematch={() => setActiveStep(2)}
          />
        )}
      </main>
    </div>
  );
};
