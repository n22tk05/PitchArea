import React, { useState, useEffect } from 'react';
import {
  FileUp,
  Mic,
  Swords,
  FileSpreadsheet,
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

  return (
    <section id="uploader" className="w-full max-w-6xl mx-auto px-6 py-12 scroll-mt-24">
      {/* Workflow Header */}
      <div className="text-center mb-8">
        <h2 className="font-headline text-2xl md:text-3xl font-bold text-black mb-2">
          Quy Trình 4 Giai Đoạn Tôi Luyện Trước Hội Đồng
        </h2>
        <p className="font-sans text-xs md:text-sm text-neutral-600 max-w-2xl mx-auto leading-relaxed">
          Mô phỏng chân thực quy trình bảo vệ đề tài: từ nạp tài liệu trích xuất dữ liệu, thuyết trình trực tiếp bằng giọng nói, đối chất sinh tử với 3 Giám khảo đến nhận báo cáo nội dung đối chất.
        </p>
      </div>

      {/* Retro Pipeline Connector Track (Progress between 4 steps) */}
      <div className="relative mb-6 hidden lg:block select-none">
        <div className="flex items-center justify-between text-neutral-500 font-mono text-[10px] font-bold uppercase tracking-wider mb-2">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-black animate-pulse" />
            <span>PIPELINE_TRACK: DATA FLOW CONNECTOR</span>
          </span>
          <span className="text-black bg-neutral-200 px-2 py-0.5 rounded border border-black/20 font-bold">
            BƯỚC {String(hoveredStep !== null ? hoveredStep : autoStep).padStart(2, '0')}/04 ACTIVE
          </span>
        </div>

        {/* The Track Line with Animated Energy Fill */}
        <div className="relative w-full h-2.5 bg-neutral-200 border-2 border-black rounded-full overflow-hidden p-[1px]">
          <div
            className="h-full bg-black transition-all duration-500 ease-out rounded-full"
            style={{
              width: `${((hoveredStep !== null ? hoveredStep : autoStep) / 4) * 100}%`,
            }}
          />
        </div>

        {/* 4 Waypoints Nodes directly mapping to 4 cards */}
        <div className="relative flex justify-between px-[10%] -mt-2 pointer-events-none">
          {[1, 2, 3, 4].map((stepNum) => {
            const isPassed = (hoveredStep !== null ? hoveredStep : autoStep) >= stepNum;
            const isCurrent = (hoveredStep !== null ? hoveredStep : autoStep) === stepNum;
            return (
              <div
                key={stepNum}
                className={`w-3.5 h-3.5 rounded-full border-2 border-black flex items-center justify-center transition-all duration-300 ${
                  isPassed
                    ? 'bg-black text-white scale-125 ring-2 ring-black/20'
                    : 'bg-white text-neutral-400'
                }`}
              >
                {isCurrent && (
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 4 Step Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {steps.map((item) => {
          const Icon = item.icon;
          const isCurrentActive =
            hoveredStep !== null ? hoveredStep === item.step : autoStep === item.step;

          return (
            <div
              key={item.step}
              onMouseEnter={() => setHoveredStep(item.step)}
              onMouseLeave={() => setHoveredStep(null)}
              onClick={() => onStepClick?.(item.step as 1 | 2 | 3 | 4)}
              className={`group relative cursor-pointer rounded-lg border-2 border-black p-4 flex flex-col justify-between gap-3 select-none overflow-hidden transition-all duration-300 ${
                isCurrentActive
                  ? 'bg-white arcade-shadow -translate-y-1 translate-x-0.5 ring-2 ring-black scale-[1.01]'
                  : 'bg-surface-container-low opacity-85 hover:opacity-100 hover:bg-white arcade-shadow-sm'
              }`}
            >
              <div className="relative z-10 flex flex-col gap-2.5">
                {/* Step Pill & Badge */}
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex items-center gap-1.5 font-mono text-[10px] px-2 py-0.5 rounded font-bold uppercase transition-colors duration-200 ${
                      isCurrentActive
                        ? 'bg-black text-white'
                        : 'bg-neutral-200 text-neutral-800'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full transition-colors duration-200 ${
                        isCurrentActive
                          ? 'bg-white animate-ping'
                          : 'bg-black opacity-60'
                      }`}
                    />
                    {item.tag}
                  </span>
                  <span
                    className={`font-mono text-[9px] font-bold uppercase tracking-wider transition-colors duration-200 ${
                      isCurrentActive ? 'text-black' : 'text-neutral-500'
                    }`}
                  >
                    {item.badge}
                  </span>
                </div>

                {/* Step Title & Icon */}
                <div className="flex items-center gap-2.5 mt-1">
                  <div
                    className={`w-9 h-9 rounded border-2 border-black flex items-center justify-center shrink-0 arcade-shadow-sm transition-all duration-200 ${
                      isCurrentActive
                        ? 'bg-black text-white scale-105 -rotate-2'
                        : 'bg-surface-container text-black'
                    }`}
                  >
                    <Icon className="w-4 h-4 transition-transform duration-200" />
                  </div>
                  <h3 className="font-headline text-sm font-bold text-black leading-snug">
                    {item.title}
                  </h3>
                </div>

                {/* Step Description */}
                <p className="font-sans text-[11px] text-neutral-600 leading-relaxed line-clamp-3">
                  {item.desc}
                </p>
              </div>

              {/* Bottom Retro Status Indicator */}
              <div
                className={`relative z-10 pt-2 border-t border-black/10 flex items-center justify-between font-mono text-[10px] font-bold transition-colors duration-200 ${
                  isCurrentActive ? 'text-black' : 'text-neutral-500'
                }`}
              >
                <span className="flex items-center gap-1 tracking-tight">
                  <span
                    className={`text-black transition-opacity duration-150 ${
                      isCurrentActive ? 'opacity-100 animate-pulse' : 'opacity-0'
                    }`}
                  >
                    ▶
                  </span>
                  <span>[{item.status}]</span>
                </span>
                <span
                  className={`transition-all duration-200 ${
                    isCurrentActive
                      ? 'animate-pixel-nudge text-black font-bold'
                      : 'text-neutral-400'
                  }`}
                >
                  →
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

