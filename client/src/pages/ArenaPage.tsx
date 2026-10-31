import React, { useState, useMemo, useEffect } from 'react';
import {
  DocumentAnalysisResult,
  LobbyConfig as LobbyConfigType,
  ArenaSessionState,
} from '@pitcharena/shared';
import {
  ArrowLeft,
  FileUp,
  Sliders,
  Mic,
  Swords,
  FileSpreadsheet,
  Sparkles,
  Gavel,
  Radio,
  Cpu,
  ShieldCheck,
  CheckCircle2,
  Terminal,
} from 'lucide-react';
import { useArenaSocket } from '../hooks/useArenaSocket';
import { GlobalMicModal } from '../components/GlobalMicModal';
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
  const [isGlobalMicOpen, setIsGlobalMicOpen] = useState<boolean>(false);
  const [documentData, setDocumentData] =
    useState<DocumentAnalysisResult | null>(null);
  const [lobbyConfig, setLobbyConfig] = useState<LobbyConfigType | null>(null);
  const [pitchTranscript, setPitchTranscript] = useState<string>('');
  const [combatSessionState, setCombatSessionState] =
    useState<ArenaSessionState | null>(null);

  useEffect(() => {
    setActiveStep(initialStep);
  }, [initialStep]);

  const changeStep = (step: 1 | 2 | 3 | 4 | 5) => {
    setActiveStep(step);
    window.location.hash = `#arena-step-${step}`;
  };

  const sessionId = useMemo(() => {
    return documentData?.documentId ? `session-${documentData.documentId}` : 'arena-session-default';
  }, [documentData?.documentId]);

  const arenaSocket = useArenaSocket(sessionId, documentData?.documentId);

  const steps = [
    {
      number: 1,
      title: '01. NẠP ĐỀ TÀI',
      sub: 'IN-MEMORY RAG',
      desc: 'Tải tài liệu luận điểm / PDF',
      icon: FileUp,
    },
    {
      number: 2,
      title: '02. CẤU HÌNH LOBBY',
      sub: 'STREAMING 220MS',
      desc: 'Hội đồng giám khảo & Voice',
      icon: Sliders,
    },
    {
      number: 3,
      title: '03. PITCH STAGE',
      sub: 'LIVE SPEECH & WPM',
      desc: 'Thuyết minh ý tưởng 60s',
      icon: Mic,
    },
    {
      number: 4,
      title: '04. ĐẤU TRƯỜNG AI',
      sub: 'COMBAT ARENA',
      desc: 'Tranh biện thời gian thực',
      icon: Swords,
    },
    {
      number: 5,
      title: '05. BÁO CÁO PHỤ LỤC',
      sub: 'DIAGNOSTIC REPORT',
      desc: 'Biểu đồ HP & Trích dẫn RAG',
      icon: FileSpreadsheet,
    },
  ] as const;

  const stageBriefings = {
    1: {
      badge: 'STAGE // 01 OF 05',
      title: 'NẠP HỒ SƠ DỰ ÁN & PHÂN TÍCH RAG',
      desc: 'Hệ thống tự động bóc tách cấu trúc luận điểm, số liệu tài chính và công nghệ cốt lõi vào In-Memory Vector Store.',
      tip: 'MẸO: Bấm [ DÙNG ĐỀ TÀI MẪU ] để nạp ngay hồ sơ FinTech mẫu hoàn chỉnh.',
    },
    2: {
      badge: 'STAGE // 02 OF 05',
      title: 'THIẾT LẬP PHÒNG ĐẤU & HỘI ĐỒNG GIÁM KHẢO',
      desc: 'Tùy biến tính cách 4 giám khảo AI, kiểm tra microphone và cấu hình độ trễ phản biện streaming 220ms.',
      tip: 'MẸO: Điều chỉnh độ khắt khe của giám khảo để thử thách khả năng chịu áp lực.',
    },
    3: {
      badge: 'STAGE // 03 OF 05',
      title: 'THUYẾT MINH DỰ ÁN TRỰC TIẾP (PITCH STAGE)',
      desc: 'Trình bày ý tưởng bằng giọng nói trong 60 giây. Hệ thống phân tích tốc độ nói (WPM) và nhận diện luận điểm.',
      tip: 'MẸO: Trình bày mạch lạc, nêu bật CAC, LTV và rào cản công nghệ cốt lõi.',
    },
    4: {
      badge: 'STAGE // 04 OF 05',
      title: 'ĐẤU TRƯỜNG TRANH BIỆN THỜI GIAN THỰC',
      desc: 'Đối đầu trực tiếp với Hội đồng Giám khảo AI. Cơ chế Strike 2 Coaching Pivot và Panic Mode 30 giây sẵn sàng.',
      tip: 'MẸO: Tự tin phản biện với số liệu thực nghiệm để hồi phục thanh Conviction Meter!',
    },
    5: {
      badge: 'STAGE // 05 OF 05',
      title: 'HỒ SƠ ĐÁNH GIÁ & PHỤ LỤC PHẢN BIỆN',
      desc: 'Phân tích toàn diện diễn biến tranh luận, biểu đồ suy hao HP và bảng phụ lục đối chiếu nguồn RAG chi tiết.',
      tip: 'MẸO: Bạn có thể chọn [ TÁI ĐẤU (REMATCH) ] để cải thiện điểm số cùng đề tài.',
    },
  } as const;

  const currentBriefing = stageBriefings[activeStep];

  const handleDocumentAnalyzed = (result: DocumentAnalysisResult) => {
    setDocumentData(result);
  };

  const handleUseDemo = () => {
    handleDocumentAnalyzed(DEMO_PROJECT_DATA);
  };

  const progressPercentage = (activeStep / 5) * 100;

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-[#1C1917] font-sans flex flex-col selection:bg-[#FEF3C7] selection:text-[#92400E] relative overflow-x-hidden">
      {/* Warm Ambient Atmosphere */}
      <div className="fixed top-0 left-1/4 w-[600px] h-[350px] bg-[radial-gradient(ellipse_at_center,rgba(217,119,6,0.08),transparent_70%)] pointer-events-none -z-10" />
      <div className="fixed top-1/3 right-10 w-[500px] h-[400px] bg-[radial-gradient(ellipse_at_center,rgba(180,83,9,0.05),transparent_70%)] pointer-events-none -z-10" />
      <div className="fixed bottom-10 left-10 w-[450px] h-[300px] bg-[radial-gradient(ellipse_at_center,rgba(217,119,6,0.06),transparent_70%)] pointer-events-none -z-10" />

      {/* Top Header Bar (Warm Sand & Bronze Studio Style) */}
      <header className="sticky top-0 z-50 bg-[#FAF8F5]/90 backdrop-blur-xl border-b border-[#D97706]/20 shadow-[0_4px_20px_rgba(217,119,6,0.06)]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          {/* Left: Home Navigation & Studio Branding */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onBackToHome}
              className="px-3 py-1.5 bg-[#FFFFFF] hover:bg-[#FEF3C7] text-[#92400E] hover:text-[#B45309] border border-[#D97706]/35 font-mono text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>[ TRANG CHỦ ]</span>
            </button>

            <div
              className="flex items-center gap-3 cursor-pointer group"
              onClick={onBackToHome}
            >
              <div className="w-9 h-9 bg-[#FEF3C7] text-[#B45309] flex items-center justify-center rounded-lg border border-[#D97706]/40 group-hover:border-[#B45309] shadow-xs group-hover:shadow-[0_0_12px_rgba(217,119,6,0.25)] transition-all">
                <Gavel className="w-4 h-4 text-[#B45309] group-hover:-rotate-12 transition-transform" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-headline font-black text-sm uppercase tracking-wider text-[#1C1917] group-hover:text-[#B45309] transition-colors">
                    PITCH·ARENA STUDIO
                  </span>
                  <span className="font-pixel text-[8px] px-1.5 py-0.5 rounded bg-[#FEF3C7] text-[#92400E] border border-[#F59E0B]/50 font-bold">
                    AI ARENA
                  </span>
                </div>
                <span className="font-mono text-[9px] text-[#78716C] tracking-tight font-bold">
                  REALTIME AI VOICE DEFENSE STUDIO // GEMINI 2.5
                </span>
              </div>
            </div>
          </div>

          {/* Right: Live Telemetry Chips & Action Buttons */}
          <div className="flex items-center gap-3">
            {/* Live Socket Status */}
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#FAF8F5] border border-[#D97706]/25">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-mono text-[10px] text-[#1C1917] font-bold">
                STREAM 220MS
              </span>
            </div>

            {/* AI Engine Model */}
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FAF8F5] border border-[#D97706]/25">
              <Cpu className="w-3 h-3 text-[#B45309]" />
              <span className="font-mono text-[10px] text-[#78716C] font-bold">
                GEMINI 2.5 FLASH
              </span>
            </div>

            {/* Global Microphone Lab Button */}
            <button
              type="button"
              onClick={() => setIsGlobalMicOpen(true)}
              className="px-2.5 py-1 bg-[#FEF3C7] hover:bg-[#FDE68A] text-[#92400E] border border-[#F59E0B]/50 font-mono text-[10px] font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:translate-x-0.5"
              title="Mở bảng kiểm thử & thiết lập Microphone (Voice Lab)"
            >
              <Mic className="w-3 h-3 text-[#B45309]" />
              <span className="hidden sm:inline">MICROPHONE</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </button>

            {/* Demo Button */}
            {!documentData && (
              <button
                type="button"
                onClick={handleUseDemo}
                className="px-3.5 py-1.5 bg-[#FEF3C7] hover:bg-[#FDE68A] text-[#92400E] font-pixel text-[10px] font-bold rounded-lg border border-[#F59E0B]/60 shadow-xs active:translate-x-0.5 active:translate-y-0.5 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 fill-[#92400E]" />
                <span>[ DÙNG ĐỀ TÀI MẪU ]</span>
              </button>
            )}
          </div>
        </div>

      </header>

      {/* Main Workspace Area */}
      <main className={`flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 flex flex-col ${activeStep === 3 ? 'py-2 sm:py-3 gap-2.5 sm:gap-3' : 'py-6 gap-6'}`}>
        {/* Stage Hero Briefing Banner */}
        <section className={`relative overflow-hidden bg-[#FFFFFF] border border-[#D97706]/30 rounded-2xl shadow-[0_8px_30px_rgba(217,119,6,0.06)] backdrop-blur-md w-full ${activeStep === 3 ? 'p-2.5 sm:p-3.5' : 'p-5 sm:p-6'}`}>
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 w-full">
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-pixel text-[9px] px-2.5 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E] border border-[#F59E0B]/50 font-bold shadow-xs">
                  {currentBriefing.badge}
                </span>
                <span className="font-mono text-[10px] text-[#78716C] uppercase tracking-wider font-bold">
                  MISSION OBJECTIVE
                </span>
              </div>
              <h1 className="font-headline font-black text-base sm:text-lg md:text-xl text-[#1C1917] tracking-wide uppercase break-words">
                {currentBriefing.title}
              </h1>
              <p className="font-sans text-xs text-[#57534E] leading-relaxed break-words max-w-3xl">
                {currentBriefing.desc}
              </p>
            </div>

            {/* Context Telemetry Status Cards */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 shrink-0 max-w-full">
              <div className="px-3 py-1.5 rounded-xl bg-[#FAF8F5] border border-[#D97706]/20 flex flex-col min-w-[100px] max-w-[160px]">
                <span className="font-pixel text-[8px] text-[#78716C] uppercase font-bold">HỒ SƠ RAG</span>
                <span
                  className="font-mono text-xs font-bold text-[#1C1917] truncate"
                  title={documentData ? (documentData.filename || documentData.documentId) : 'CHƯA NẠP'}
                >
                  {documentData ? (documentData.filename || documentData.documentId) : 'CHƯA NẠP'}
                </span>
              </div>

              <div className="px-3 py-1.5 rounded-xl bg-[#FAF8F5] border border-[#D97706]/20 flex flex-col min-w-[85px]">
                <span className="font-pixel text-[8px] text-[#78716C] uppercase font-bold">HỘI ĐỒNG AI</span>
                <span className="font-mono text-xs font-bold text-[#B45309]">
                  4 GIÁM KHẢO
                </span>
              </div>

              <div className="px-3 py-1.5 rounded-xl bg-[#FAF8F5] border border-[#D97706]/20 flex flex-col min-w-[95px]">
                <span className="font-pixel text-[8px] text-[#78716C] uppercase font-bold">CHẾ ĐỘ</span>
                <span className="font-mono text-xs font-bold text-[#0891B2]">
                  VOICE DEFENSE
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Stage Main Frame */}
        <div className={`relative bg-[#FFFFFF] border border-[#D97706]/30 rounded-2xl shadow-[0_12px_44px_rgba(217,119,6,0.08)] ${activeStep === 3 ? 'p-3 sm:p-4' : 'p-6 md:p-8'}`}>
          {/* Corner Notch Accents */}
          <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[#D97706] rounded-tl-2xl" />
          <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-[#D97706] rounded-tr-2xl" />
          <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-[#D97706]/60 rounded-bl-2xl" />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[#D97706]/60 rounded-br-2xl" />

          {/* Active Step Content */}
          {activeStep === 1 && (
            <Step1Upload
              documentData={documentData}
              onDocumentAnalyzed={handleDocumentAnalyzed}
              onNext={() => changeStep(2)}
              onReset={() => setDocumentData(null)}
              onUseDemo={handleUseDemo}
            />
          )}

          {activeStep === 2 && (
            <Step2Lobby
              documentData={documentData}
              onBack={() => changeStep(1)}
              onNext={(cfg) => {
                if (cfg) setLobbyConfig(cfg);
                changeStep(3);
              }}
              onUseDemo={handleUseDemo}
            />
          )}

          {activeStep === 3 && (
            <Step3Pitching
              documentData={documentData}
              lobbyConfig={lobbyConfig}
              arenaSocket={arenaSocket}
              onBack={() => changeStep(2)}
              onNext={(transcript) => {
                if (transcript) setPitchTranscript(transcript);
                changeStep(4);
              }}
            />
          )}

          {activeStep === 4 && (
            <Step4Combat
              documentData={documentData}
              lobbyConfig={lobbyConfig}
              pitchTranscript={pitchTranscript}
              arenaSocket={arenaSocket}
              onBack={() => changeStep(3)}
              onNext={(finalSession) => {
                if (finalSession) setCombatSessionState(finalSession);
                changeStep(5);
              }}
            />
          )}

          {activeStep === 5 && (
            <Step5Report
              documentData={documentData}
              reportData={arenaSocket.reportData}
              sessionState={arenaSocket.sessionState || combatSessionState}
              onResetToStep1={() => {
                setDocumentData(null);
                setCombatSessionState(null);
                changeStep(1);
              }}
              onRematch={() => {
                arenaSocket.requestRematch();
                setCombatSessionState(null);
                changeStep(2);
              }}
            />
          )}
        </div>
      </main>
    </div>
  );
};
