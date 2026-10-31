import React, { useState, useEffect } from 'react';
import {
  FileUp,
  Mic,
  Swords,
  FileSpreadsheet,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { DocumentAnalysisResult } from '@pitcharena/shared';

interface ProjectWorkflowProps {
  onAnalysisComplete?: (result: DocumentAnalysisResult) => void;
  onStepClick?: (step: 1 | 2 | 3 | 4) => void;
}

export const ProjectWorkflow: React.FC<ProjectWorkflowProps> = ({
  onAnalysisComplete,
  onStepClick,
}) => {
  const [autoStep, setAutoStep] = useState<number>(1);
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);

  // Autonomous Sequential Radar Loop across the 4 steps (3-second cycle)
  useEffect(() => {
    const timer = setInterval(() => {
      setAutoStep((prev) => (prev % 4) + 1);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const steps = [
    {
      step: 1,
      tag: 'BƯỚC 01',
      badge: 'IN-MEMORY RAG',
      title: 'Nạp Dữ Liệu Đề Tài',
      desc: 'Nạp tệp Word (.docx), hệ thống tự bóc tách 5 khối kinh doanh trọng yếu và nhận diện 3 điểm mù rủi ro trước giờ G.',
      icon: FileUp,
      status: 'SẴN SÀNG NẠP',
    },
    {
      step: 2,
      tag: 'BƯỚC 02',
      badge: 'PITCHING STAGE',
      title: 'Thuyết Trình Đề Tài',
      desc: 'Trình bày ý tưởng 3-5 phút với micro trực tiếp, streaming STT 220ms hiển thị phụ đề và đối soát dữ liệu theo thời gian thực.',
      icon: Mic,
      status: 'VOICE STT',
    },
    {
      step: 3,
      tag: 'BƯỚC 03',
      badge: 'COMBAT ARENA',
      title: 'Phản Biện Đối Chất',
      desc: 'Đối đầu trực tiếp 3 Giám khảo AI độc lập, đồng hồ đếm ngược 30s/lượt, VAD bắt ngập ngừng và phạt -15% máu khi ngụy biện.',
      icon: Swords,
      status: 'SOLO BOSS Q&A',
    },
    {
      step: 4,
      tag: 'BƯỚC 04',
      badge: 'DIAGNOSTIC REPORT',
      title: 'Tổng Hợp & Đánh Giá',
      desc: 'Bảo vệ bởi sàn máu tân thủ 20%, hệ thống tự động xuất Báo cáo Phụ lục 3 cột chỉ rõ luận điểm yếu để tái đấu lập tức.',
      icon: FileSpreadsheet,
      status: 'PHỤ LỤC 3 CỘT',
    },
  ];

  const activeStepNum = hoveredStep !== null ? hoveredStep : autoStep;

  return (
    <section id="uploader" className="w-full max-w-7xl mx-auto px-6 py-14 scroll-mt-24">
      {/* Workflow Header (Centered & Warm Bronze) */}
      <div className="text-center max-w-3xl mx-auto mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FEF3C7] border border-[#F59E0B]/50 mb-3 shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-[#D97706]" />
          <span className="font-pixel text-[10px] text-[#92400E] uppercase tracking-wider font-bold">
            PIPELINE ARCHITECTURE // 4 PHASES
          </span>
        </div>
        <h2 className="font-headline text-2xl md:text-4xl font-black text-[#1C1917] uppercase tracking-tight">
          Quy Trình 4 Giai Đoạn Tôi Luyện Trước Hội Đồng
        </h2>
        <p className="font-sans text-xs md:text-sm text-[#57534E] mt-2 leading-relaxed">
          Mô phỏng chân thực quy trình bảo vệ đề tài: từ nạp tài liệu trích xuất dữ liệu, thuyết trình trực tiếp bằng giọng nói, đối chất sinh tử với 4 Giám khảo đến nhận báo cáo nội dung đối chất.
        </p>
      </div>

      {/* Sleek Progression Dock Connector Bar */}
      <div className="relative mb-6 hidden lg:block select-none bg-[#FFFFFF] border border-[#D97706]/25 rounded-xl p-3 shadow-sm">
        <div className="flex items-center justify-between text-[#B45309] font-mono text-[11px] font-bold uppercase tracking-wider">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#D97706] animate-pulse" />
            <span className="text-[#1C1917]">TIẾN TRÌNH TÁC CHIẾN TỰ ĐỘNG</span>
          </div>

          {/* Stepper Dots Track */}
          <div className="flex items-center gap-6">
            {steps.map((s) => (
              <div
                key={s.step}
                className={`flex items-center gap-2 cursor-pointer transition-colors ${
                  activeStepNum === s.step ? 'text-[#B45309]' : 'text-[#78716C]'
                }`}
                onClick={() => onStepClick?.(s.step as 1 | 2 | 3 | 4)}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    activeStepNum === s.step
                      ? 'bg-[#D97706] shadow-[0_0_8px_rgba(217,119,6,0.8)]'
                      : 'bg-[#F5EFEB] border border-[#D97706]/40'
                  }`}
                />
                <span className="font-pixel text-[9px]">{s.tag}</span>
              </div>
            ))}
          </div>

          <span className="text-[#92400E] bg-[#FEF3C7] px-3 py-1 rounded border border-[#F59E0B]/50 font-pixel text-[10px] font-bold">
            GIAI ĐOẠN 0{activeStepNum}/04 ĐANG CHẠY
          </span>
        </div>
      </div>

      {/* 4 Step Cards Seamless Flush-Fit Row (Sáp vách nhau) */}
      <div className="w-full bg-[#FFFFFF] border border-[#D97706]/30 rounded-2xl shadow-[0_12px_40px_rgba(217,119,6,0.06)] overflow-hidden grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#D97706]/20">
        {steps.map((item) => {
          const Icon = item.icon;
          const isCurrentActive = activeStepNum === item.step;

          return (
            <div
              key={item.step}
              onMouseEnter={() => setHoveredStep(item.step)}
              onMouseLeave={() => setHoveredStep(null)}
              onClick={() => onStepClick?.(item.step as 1 | 2 | 3 | 4)}
              className={`group relative cursor-pointer p-5 flex flex-col justify-between gap-4 select-none transition-all duration-200 ${
                isCurrentActive
                  ? 'bg-[#FAF8F5] ring-2 ring-[#D97706] ring-inset'
                  : 'bg-[#FFFFFF] hover:bg-[#FAF8F5]/60'
              }`}
            >
              <div className="relative z-10 flex flex-col gap-3">
                {/* Step Pill & Badge */}
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex items-center gap-1.5 font-pixel text-[10px] px-2.5 py-1 rounded font-bold uppercase transition-colors duration-200 ${
                      isCurrentActive
                        ? 'bg-[#D97706] text-white shadow-xs'
                        : 'bg-[#F5EFEB] text-[#57534E] border border-[#D97706]/30'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full transition-colors duration-200 ${
                        isCurrentActive ? 'bg-white animate-ping' : 'bg-[#D97706]'
                      }`}
                    />
                    {item.tag}
                  </span>
                  <span
                    className={`font-mono text-[10px] font-bold uppercase tracking-wider transition-colors duration-200 ${
                      isCurrentActive ? 'text-[#B45309]' : 'text-[#78716C]'
                    }`}
                  >
                    {item.badge}
                  </span>
                </div>

                {/* Step Title & Icon */}
                <div className="flex items-center gap-3 mt-1">
                  <div
                    className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 transition-all duration-200 ${
                      isCurrentActive
                        ? 'bg-[#D97706] text-white border-[#D97706] shadow-[0_0_12px_rgba(217,119,6,0.3)] scale-105'
                        : 'bg-[#F5EFEB] text-[#B45309] border-[#D97706]/40'
                    }`}
                  >
                    <Icon className="w-5 h-5 transition-transform duration-200" />
                  </div>
                  <h3 className="font-headline text-base font-bold text-[#1C1917] leading-snug">
                    {item.title}
                  </h3>
                </div>

                {/* Step Description */}
                <p className="font-sans text-xs text-[#57534E] leading-relaxed">
                  {item.desc}
                </p>
              </div>

              {/* Bottom Status Indicator */}
              <div
                className={`relative z-10 pt-3 border-t border-[#D97706]/15 flex items-center justify-between font-pixel text-[10px] font-bold transition-colors duration-200 ${
                  isCurrentActive ? 'text-[#B45309]' : 'text-[#78716C]'
                }`}
              >
                <span className="flex items-center gap-1.5 tracking-tight">
                  <span
                    className={`transition-opacity duration-150 ${
                      isCurrentActive ? 'opacity-100 animate-pulse text-[#D97706]' : 'opacity-0'
                    }`}
                  >
                    ▶
                  </span>
                  <span>[{item.status}]</span>
                </span>
                <span
                  className={`transition-all duration-200 ${
                    isCurrentActive
                      ? 'text-[#B45309] font-bold translate-x-1'
                      : 'text-[#A8A29E]'
                  }`}
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
