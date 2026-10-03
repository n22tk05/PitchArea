import React, { useState } from 'react';
import {
  DocumentAnalysisResult,
  BusinessSectionType,
  BusinessSectionLabel,
  JuryBossId,
  JURY_BOSS_PROFILES,
} from '@pitcharena/shared';
import {
  ArrowLeft,
  FileUp,
  Sliders,
  Swords,
  FileSpreadsheet,
  CheckCircle2,
  Sparkles,
  Play,
  RotateCcw,
  Shield,
  AlertTriangle,
  Flame,
  ArrowRight,
  Gavel,
} from 'lucide-react';
import { DocumentUploader, fixMojibake } from '../components/DocumentUploader';
import { LobbyConfig } from '../components/LobbyConfig';

// Dữ liệu mẫu đề tài khởi nghiệp MedTech AI để thử nghiệm tức thì
export const DEMO_PROJECT_DATA: DocumentAnalysisResult = {
  documentId: 'doc-demo-startup-medtech',
  filename: 'Thuyet_Minh_De_Tai_AI_Medical_Assistant.docx',
  fileSizeBytes: 2450000,
  markdownContent: '# AI Medical Assistant - Trợ lý lâm sàng chuyên sâu...',
  sections: [
    {
      id: 'sec-1-problem',
      type: BusinessSectionType.PROBLEM_MARKET,
      title: 'Vấn đề & Quy mô Thị trường',
      content:
        'Thị trường MedTech Việt Nam đạt 1.2 tỷ USD, giải quyết tình trạng quá tải 40% tại các phòng khám công lập và tư nhân.',
      charCount: 110,
      wordCount: 22,
    },
    {
      id: 'sec-2-solution',
      type: BusinessSectionType.SOLUTION_PRODUCT,
      title: 'Giải pháp & Sản phẩm cốt lõi',
      content:
        'Trợ lý AI hỗ trợ chẩn đoán thời gian thực với độ trễ dưới 220ms, độ chính xác lâm sàng đạt 94.2%.',
      charCount: 99,
      wordCount: 18,
    },
    {
      id: 'sec-3-business',
      type: BusinessSectionType.BUSINESS_MODEL_UNIT_ECONOMICS,
      title: 'Mô hình Kinh doanh & Unit Economics',
      content:
        'Mô hình B2B Subscription: 15 triệu VNĐ/phòng khám/tháng. Chỉ số CAC 3.2 triệu VNĐ, LTV đạt 48 triệu VNĐ, tỷ lệ hoàn vốn sau 8 tháng.',
      charCount: 135,
      wordCount: 24,
    },
    {
      id: 'sec-4-moat',
      type: BusinessSectionType.COMPETITION_MOAT,
      title: 'Đối thủ & Lợi thế Cạnh tranh (Moat)',
      content:
        'Bộ dữ liệu độc quyền 50,000 ca bệnh án tiếng Việt, độc quyền tích hợp với 3 chuỗi bệnh viện tư nhân lớn.',
      charCount: 108,
      wordCount: 20,
    },
    {
      id: 'sec-5-roadmap',
      type: BusinessSectionType.SOCIAL_IMPACT_ROADMAP,
      title: 'Tác động Xã hội & Lộ trình Phát triển',
      content:
        'Giai đoạn thử nghiệm Q3/2026 tại 15 cơ sở, mở rộng 120 phòng khám khu vực miền Nam vào Q1/2027.',
      charCount: 98,
      wordCount: 18,
    },
  ],
  entityWhitelist: [
    {
      id: 'ent-1',
      rawText: '1.2 tỷ USD',
      category: 'CURRENCY',
      value: '1.2B USD',
      contextSentence: 'Thị trường MedTech đạt 1.2 tỷ USD.',
      sectionType: BusinessSectionType.PROBLEM_MARKET,
    },
    {
      id: 'ent-2',
      rawText: 'CAC 3.2 triệu VNĐ, LTV 48 triệu VNĐ',
      category: 'METRIC',
      value: 'CAC 3.2M, LTV 48M',
      contextSentence: 'Chỉ số CAC 3.2 triệu, LTV đạt 48 triệu.',
      sectionType: BusinessSectionType.BUSINESS_MODEL_UNIT_ECONOMICS,
    },
  ],
  blindSpots: [
    {
      id: 'bs-1',
      domain: BusinessSectionType.BUSINESS_MODEL_UNIT_ECONOMICS,
      severity: 'HIGH',
      title: 'Rủi ro suy kiệt dòng tiền do chi phí API LLM',
      description:
        'Chưa tính toán chi phí token suy luận tăng theo quy mô lượt khám, có thể đẩy biên lợi nhuận xuống dưới mức hòa vốn.',
      attackVector:
        'GS. Vũ Hoàng sẽ xoáy sâu vào chi phí biến đổi trên từng lượt truy vấn y khoa.',
    },
    {
      id: 'bs-2',
      domain: BusinessSectionType.COMPETITION_MOAT,
      severity: 'MEDIUM',
      title: 'Rào cản phòng thủ trước các tập đoàn phần mềm HIS',
      description:
        'Các nhà cung cấp phần mềm bệnh viện hiện tại có thể tích hợp AI wrapper miễn phí để đè bẹp giải pháp.',
      attackVector:
        'Shark Trần Nam sẽ chất vấn kế hoạch giữ chân khách hàng khi đối thủ giảm giá 0 đồng.',
    },
  ],
  processedAt: new Date().toISOString(),
};

interface ArenaPageProps {
  initialStep?: 1 | 2 | 3 | 4;
  onBackToHome: () => void;
}

export const ArenaPage: React.FC<ArenaPageProps> = ({
  initialStep = 1,
  onBackToHome,
}) => {
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(initialStep);
  const [documentData, setDocumentData] =
    useState<DocumentAnalysisResult | null>(null);

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
      title: 'PHẢN BIỆN ĐỐI CHẤT',
      sub: 'COMBAT ARENA',
      icon: Swords,
    },
    {
      number: 4,
      title: 'TỔNG HỢP & ĐÁNH GIÁ',
      sub: 'DIAGNOSTIC REPORT',
      icon: FileSpreadsheet,
    },
  ] as const;

  const handleDocumentAnalyzed = (result: DocumentAnalysisResult) => {
    setDocumentData(result);
    // Tự động chuyển tiếp sang Bước 2 (Sảnh đấu) sau khi nạp xong
    // setActiveStep(2);
  };

  return (
    <div className="min-h-screen bg-neutral-100 text-black font-sans flex flex-col selection:bg-black selection:text-white">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-50 bg-white border-b-2 border-black shadow-[0_2px_0px_#000]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBackToHome}
              className="px-3 py-1.5 border-2 border-black font-mono text-xs font-bold bg-white hover:bg-neutral-100 active:translate-x-0.5 active:translate-y-0.5 flex items-center gap-1.5 shadow-[2px_2px_0px_#000]"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>[ ← TRANG CHỦ ]</span>
            </button>

            <div className="h-6 w-[2px] bg-black/20 hidden sm:block" />

            <div className="flex items-center gap-2">
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
                onClick={() => handleDocumentAnalyzed(DEMO_PROJECT_DATA)}
                className="px-2.5 py-1.5 bg-amber-400 border-2 border-black font-mono text-[11px] font-bold shadow-[2px_2px_0px_#000] hover:bg-amber-300 active:translate-x-0.5 active:translate-y-0.5 flex items-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5 fill-black" />
                [ DÙNG ĐỀ TÀI MẪU ]
              </button>
            )}

          
          </div>
        </div>

        {/* 4-Step Navigation Tab Bar */}
        <div className="bg-neutral-50 border-t border-black/20 overflow-x-auto">
          <div className="max-w-7xl mx-auto px-6 flex items-center gap-2 py-2">
            {steps.map((st) => {
              const isActive = activeStep === st.number;
              const isPassed = activeStep > st.number;
              const Icon = st.icon;

              return (
                <button
                  key={st.number}
                  type="button"
                  onClick={() => {
                    // Chỉ cho phép nhảy sang bước 2, 3, 4 nếu đã có dữ liệu đề tài
                    if (st.number > 1 && !documentData) {
                      setDocumentData(DEMO_PROJECT_DATA);
                    }
                    setActiveStep(st.number);
                  }}
                  className={`flex-1 min-w-[200px] p-2.5 border-2 transition-all flex items-center gap-2.5 text-left font-mono ${
                    isActive
                      ? 'border-black bg-black text-white shadow-[3px_3px_0px_#eab308]'
                      : isPassed
                      ? 'border-black bg-white text-black shadow-[2px_2px_0px_#000] hover:bg-neutral-100'
                      : 'border-neutral-300 bg-neutral-100 text-neutral-500 hover:border-black hover:text-black'
                  }`}
                >
                  <div
                    className={`w-7 h-7 border flex items-center justify-center font-bold text-xs shrink-0 ${
                      isActive
                        ? 'border-amber-400 bg-amber-400 text-black'
                        : isPassed
                        ? 'border-black bg-black text-white'
                        : 'border-neutral-400 bg-white text-neutral-600'
                    }`}
                  >
                    {isPassed ? '✓' : `0${st.number}`}
                  </div>

                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-[11px] truncate uppercase leading-tight">
                      {st.title}
                    </span>
                    <span
                      className={`text-[9px] truncate ${
                        isActive ? 'text-amber-300' : 'text-neutral-500'
                      }`}
                    >
                      {st.sub}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Step Screen Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        {/* ===================== BƯỚC 01: NẠP DỮ LIỆU ĐỀ TÀI ===================== */}
        {activeStep === 1 && (
          <div className="flex flex-col gap-6 animate-fadeIn">
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
                  onClick={() => handleDocumentAnalyzed(DEMO_PROJECT_DATA)}
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
              onAnalysisComplete={handleDocumentAnalyzed}
              onNext={() => setActiveStep(2)}
              onReset={() => setDocumentData(null)}
            />
          </div>
        )}

        {/* ===================== BƯỚC 02: SẢNH ĐẤU & VOICE LOBBY ===================== */}
        {activeStep === 2 && (
          <div className="flex flex-col gap-6 animate-fadeIn">
            {documentData ? (
              <>
                <LobbyConfig
                  documentData={documentData}
                  onBackToUpload={() => setActiveStep(1)}
                />

                {/* Nút tiến bước sang Đấu trường Bước 3 */}
                <div className="border-2 border-black bg-white p-4 shadow-[4px_4px_0px_#000] flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setActiveStep(1)}
                    className="px-3 py-2 border-2 border-black font-mono text-xs font-bold hover:bg-neutral-100 flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    QUAY LẠI BƯỚC 01
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveStep(3)}
                    className="px-5 py-2.5 bg-black text-white font-mono font-bold text-xs border-2 border-black shadow-[3px_3px_0px_#eab308] hover:bg-neutral-800 active:translate-x-0.5 active:translate-y-0.5 flex items-center gap-2"
                  >
                    <span>VÀO SÂN KHẤU PHẢN BIỆN (BƯỚC 03)</span>
                    <ArrowRight className="w-4 h-4 text-amber-400" />
                  </button>
                </div>
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
                  onClick={() => handleDocumentAnalyzed(DEMO_PROJECT_DATA)}
                  className="px-4 py-2 bg-amber-400 border-2 border-black font-mono text-xs font-bold shadow-[2px_2px_0px_#000]"
                >
                  NẠP ĐỀ TÀI MẪU NGAY
                </button>
              </div>
            )}
          </div>
        )}

        {/* ===================== BƯỚC 03: ĐẤU TRƯỜNG PHẢN BIỆN (COMBAT ARENA) ===================== */}
        {activeStep === 3 && (
          <div className="flex flex-col gap-6 animate-fadeIn">
            {/* Arena Stage Viewport */}
            <div className="border-2 border-black bg-white p-6 shadow-[6px_6px_0px_#000] flex flex-col gap-6">
              {/* Header Status Bar */}
              <div className="flex items-center justify-between pb-3 border-b-2 border-black">
                <div className="flex items-center gap-2">
                  <span className="bg-rose-600 text-white font-mono text-xs font-bold px-2 py-0.5 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                    LIVE COMBAT // VÒNG 01/03
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
                    onClick={() => setActiveStep(4)}
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

              {/* Step 3 Navigation Controls */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setActiveStep(2)}
                  className="px-3 py-2 border-2 border-black font-mono text-xs font-bold hover:bg-neutral-100 flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  SẢNH ĐẤU (BƯỚC 02)
                </button>

                <button
                  type="button"
                  onClick={() => setActiveStep(4)}
                  className="px-5 py-2.5 bg-black text-white font-mono font-bold text-xs border-2 border-black shadow-[3px_3px_0px_#eab308] hover:bg-neutral-800 active:translate-x-0.5 active:translate-y-0.5 flex items-center gap-2"
                >
                  <span>XEM BÁO CÁO PHỤ LỤC (BƯỚC 04)</span>
                  <ArrowRight className="w-4 h-4 text-amber-400" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===================== BƯỚC 04: TỔNG HỢP & BÁO CÁO PHỤ LỤC ===================== */}
        {activeStep === 4 && (
          <div className="flex flex-col gap-6 animate-fadeIn">
            <div className="border-2 border-black bg-white p-5 shadow-[4px_4px_0px_#000] flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="font-mono text-xs font-bold bg-black text-white px-2 py-0.5">
                  BƯỚC 04 // TỔNG KẾT TRẬN ĐẤU
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
                  onClick={() => setActiveStep(2)}
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
                onClick={() => setActiveStep(1)}
                className="px-3 py-2 border-2 border-black font-mono text-xs font-bold hover:bg-neutral-100 flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                NẠP ĐỀ TÀI KHÁC (BƯỚC 01)
              </button>

              <button
                type="button"
                onClick={() => setActiveStep(2)}
                className="px-5 py-2.5 bg-black text-white font-mono font-bold text-xs border-2 border-black shadow-[3px_3px_0px_#eab308] hover:bg-neutral-800 active:translate-x-0.5 active:translate-y-0.5 flex items-center gap-2"
              >
                <Play className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span>BẮT ĐẦU VÒNG TÁI ĐẤU MỚI (BƯỚC 02)</span>
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
