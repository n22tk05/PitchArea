import React, { useMemo } from 'react';
import {
  AppendixReport,
  ArenaSessionState,
  DocumentAnalysisResult,
  JuryBossId,
} from '@pitcharena/shared';
import {
  RotateCcw,
  Play,
  Download,
  Printer,
  ShieldCheck,
  ShieldAlert,
  Award,
  FileText,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { AppendixTable } from '../../components/AppendixTable';
import { HpTimelineChart } from '../../components/HpTimelineChart';

interface Step5ReportProps {
  documentData: DocumentAnalysisResult | null;
  reportData?: AppendixReport | null;
  sessionState?: ArenaSessionState | null;
  onResetToStep1: () => void;
  onRematch: () => void;
}

export const Step5Report: React.FC<Step5ReportProps> = ({
  documentData,
  reportData,
  sessionState,
  onResetToStep1,
  onRematch,
}) => {
  // 1. Tự động tổng hợp hoặc trích xuất báo cáo từ props
  const report: AppendixReport = useMemo(() => {
    if (reportData) return reportData;
    if (sessionState?.report) return sessionState.report;

    // Fallback tổng hợp từ sessionState thực tế
    const finalHp = sessionState?.candidateHp ?? 75;
    const passed = finalHp > (sessionState?.config?.pedagogicalShieldFloor ?? 20);

    const defaultItems = [
      {
        turnIndex: 1,
        bossId: JuryBossId.FINANCE_DRAGON,
        bossName: 'GS. Vũ Hoàng (Tài chính)',
        topic: 'Unit Economics & Dòng tiền',
        question: 'Chi phí API và hạ tầng máy chủ trong 6 tháng đầu được bù đắp bằng nguồn thu nào?',
        candidateAnswer: 'Nhóm dự kiến lấy tiền từ giải thưởng và tiền túi của các thành viên.',
        weaknessIdentified: 'Chưa có mô hình bù đắp chi phí tự thân, tiềm ẩn nguy cơ âm dòng tiền.',
        fallacyType: 'Ảo tưởng dòng tiền ngoại sinh',
        slideActionProposal: 'Bổ sung bảng phân bổ chi phí cố định theo tháng và điểm hòa vốn tối thiểu 50 khách hàng trả phí.',
        recommendedSlideTitle: 'Slide Phụ lục F1: Bảng Tính Điểm Hòa Vốn & Chi Phí Hạ Tầng',
        hpImpact: -15,
        score: { directness: 50, factualBacking: 40, intellectualHonesty: 60, overallScore: 50 },
        severity: 'CRITICAL' as const,
        juryIntent: 'Thẩm định tính tự chủ dòng tiền, cơ cấu chi phí vận hành (OpEx) và điểm hòa vốn thực tế trước khi cạn kiệt ngân sách.',
        slideStructureBullets: [
          'Khối 1: Bảng phân bổ chi phí cố định (API + Máy chủ + Vận hành) theo từng tháng.',
          'Khối 2: Biểu đồ điểm hòa vốn (Break-even): Mốc số lượng khách hàng trả phí cần đạt.',
          'Khối 3: Nguồn vốn dự phòng & Kế hoạch duy trì tối thiểu 6 tháng khi chưa có lãi.',
        ],
        actionSteps: [
          'Bước 1 (Tính chi phí OpEx): Lập bảng Excel dự toán chi phí cố định tối thiểu (API, Server, Domain, Vận hành) theo từng tháng trong 6 tháng đầu.',
          'Bước 2 (Tính điểm hòa vốn): Tính toán số lượng khách hàng trả phí tối thiểu cần đạt để doanh thu tự bù đắp toàn bộ chi phí vận hành hàng tháng.',
          'Bước 3 (Đóng gói Slide F1): Lập bảng chi phí vs doanh thu và vẽ biểu đồ điểm hòa vốn đưa vào Slide Phụ lục F1 sẵn sàng phản biện.',
        ],
        winningResponse: 'Thưa Thầy/Cô, chi phí vận hành tối thiểu 6 tháng đầu là 45 triệu VNĐ. Nhóm đã nhận gói tài trợ Cloud Credits 10.000$ từ chương trình ươm tạo, đủ duy trì máy chủ cho 1.000 người dùng đầu tiên mà không chịu áp lực dòng tiền.',
      },
      {
        turnIndex: 2,
        bossId: JuryBossId.TECH_SENTINEL,
        bossName: 'TS. Lê Minh Trang (Công nghệ)',
        topic: 'Kiến trúc Fallback & Sẵn sàng',
        question: 'Khi mạng chập chờn hoặc API bên thứ ba mất kết nối, hệ thống xử lý ra sao?',
        candidateAnswer: 'Nhóm có cơ chế Local Fallback Tokenizer xử lý dưới 5ms ngay trong RAM.',
        weaknessIdentified: 'Luận điểm tốt, có giải pháp kỹ thuật rõ ràng bảo vệ trải nghiệm người dùng.',
        fallacyType: undefined,
        slideActionProposal: 'Đưa sơ đồ luồng dữ liệu 2 tầng (Cloud Stream & Local Offline Engine) vào phụ lục kỹ thuật.',
        recommendedSlideTitle: 'Slide Phụ lục T2: Kiến Trúc Dự Phòng Phục Hồi Tức Thì',
        hpImpact: 10,
        score: { directness: 90, factualBacking: 85, intellectualHonesty: 95, overallScore: 90 },
        severity: 'GOOD' as const,
        juryIntent: 'Thẩm định tính khả thi kỹ thuật, độ trễ và cơ chế dự phòng ngoại lệ khi mạng sập hoặc API bên thứ ba mất kết nối.',
        slideStructureBullets: [
          'Khối 1: Sơ đồ luồng dữ liệu 2 tầng: Xử lý Cloud Stream & Bộ đệm Offline cục bộ.',
          'Khối 2: Thông số thực nghiệm: Độ trễ P95 (<220ms), tải RAM và giới hạn chịu lỗi.',
          'Khối 3: Ma trận xử lý ngoại lệ: Trải nghiệm thông báo thân thiện khi mất kết nối.',
        ],
        actionSteps: [
          'Bước 1 (Thiết kế luồng dự phòng): Vẽ sơ đồ khối kiến trúc 2 tầng (Primary Cloud Flow & Local Fallback Cache) xử lý tình huống mất kết nối mạng.',
          'Bước 2 (Đo lường thông số): Chạy thử nghiệm đo lường độ trễ phản hồi (P95 < 220ms), tải RAM và tỷ lệ thành công của API để có số liệu thực nghiệm.',
          'Bước 3 (Đóng gói Slide T2): Đưa sơ đồ kiến trúc dự phòng và bảng kết quả đo lường độ trễ thực tế vào Slide Phụ lục T2.',
        ],
        winningResponse: 'Thưa Thầy/Cô, hệ thống được thiết kế kiến trúc Fallback 2 tầng: khi mạng ngắt quãng, Engine cục bộ trên thiết bị sẽ kích hoạt cơ chế Local Cache dưới 5ms để bảo đảm trải nghiệm của người dùng hoàn toàn liền mạch.',
      },
      {
        turnIndex: 3,
        bossId: JuryBossId.MARKET_SHARK,
        bossName: 'Shark Trần Nam (Thị trường)',
        topic: 'Cam kết Chi trả Thực tế',
        question: 'Bằng chứng nào cho thấy người cao tuổi hoặc trường đại học sẵn sàng trả tiền?',
        candidateAnswer: 'Khảo sát 200 người thấy 85% phản hồi tích cực và mong muốn sử dụng.',
        weaknessIdentified: 'Khảo sát thái độ chưa đồng nghĩa với hành vi trả tiền thực tế.',
        fallacyType: 'Ngụy biến nhầm lẫn Khảo sát và Đơn hàng',
        slideActionProposal: 'Thực hiện 10 buổi phỏng vấn sâu hoặc lấy thư xác nhận thử nghiệm có thu phí (LOI) từ 3 đối tác.',
        recommendedSlideTitle: 'Slide Phụ lục M1: Bằng Chứng Nhu Cầu & Cam Kết Trả Phí',
        hpImpact: -10,
        score: { directness: 60, factualBacking: 55, intellectualHonesty: 65, overallScore: 60 },
        severity: 'WARNING' as const,
        juryIntent: 'Thẩm định bằng chứng nhu cầu thực tế và mức độ sẵn sàng chi trả của khách hàng mục tiêu, bóc trần khảo sát thái độ ảo.',
        slideStructureBullets: [
          'Khối 1: Dữ liệu phỏng vấn sâu 10-15 khách hàng & Trích dẫn trực tiếp về nỗi đau.',
          'Khối 2: Bằng chứng cam kết chi trả thực tế (Thư quan tâm LOI / Đơn đặt trước pilot).',
          'Khối 3: Phân tích chi phí tìm khách (CAC) và kênh tiếp cận 100 người dùng đầu tiên.',
        ],
        actionSteps: [
          'Bước 1 (Xác thực thực tế): Phỏng vấn sâu 10 - 15 khách hàng mục tiêu để ghi nhận nỗi đau thực tế và mức độ sẵn sàng chi trả thay vì khảo sát lý thuyết.',
          'Bước 2 (Lấy cam kết thử nghiệm): Ký kết hoặc xin tối thiểu 3 Thư xác nhận quan tâm (LOI / Pilot Agreement) có điều khoản trả phí thử nghiệm danh nghĩa.',
          'Bước 3 (Đóng gói Slide M1): Đưa hình ảnh phỏng vấn, logo đối tác pilot và tỷ lệ chuyển đổi thực tế vào Slide Phụ lục M1.',
        ],
        winningResponse: 'Thưa Thầy/Cô, thay vì chỉ dừng ở phiếu khảo sát, nhóm đã tiến hành phỏng vấn sâu 15 khách hàng đại diện và ký kết 3 Thư xác nhận quan tâm (LOI) có cam kết trả phí pilot danh nghĩa khi bản MVP vận hành thử nghiệm.',
      },
    ];

    const hpHistory = [
      { turn: 0, bossId: JuryBossId.FINANCE_DRAGON, hp: 100, hpDelta: 0, topic: 'Khởi đầu' },
      { turn: 1, bossId: JuryBossId.FINANCE_DRAGON, hp: 85, hpDelta: -15, topic: 'Dòng tiền' },
      { turn: 2, bossId: JuryBossId.TECH_SENTINEL, hp: 95, hpDelta: 10, topic: 'Công nghệ' },
      { turn: 3, bossId: JuryBossId.MARKET_SHARK, hp: finalHp, hpDelta: -10, topic: 'Khách hàng' },
    ];

    return {
      sessionId: sessionState?.sessionId || `session-${Date.now()}`,
      documentId: documentData?.documentId || 'doc-default',
      documentTitle: documentData?.filename || 'Đề án Khởi nghiệp Sinh viên',
      candidateHp: finalHp,
      totalTurns: defaultItems.length,
      passed,
      overallScore: 67,
      grade: (passed && finalHp >= 80 ? 'XUẤT SẮC (PASS+)' : passed && finalHp >= 50 ? 'ĐẠT YÊU CẦU (PASS)' : 'CẦN HOÀN THIỆN (REVISE)'),
      defenseSuccessRate: 67,
      strengthsSummary: [
        'Luận điểm công nghệ vững chắc, có phương án phòng thủ kiến trúc dự phòng chi tiết.',
        'Tinh thần bảo vệ đề tài tự tin, tiếp thu góp ý của Hội đồng.',
      ],
      criticalRisksSummary: [
        'Dòng tiền 6 tháng đầu chưa có điểm tựa doanh thu thực tế.',
        'Thiếu bằng chứng cam kết chi trả của khách hàng mục tiêu.',
      ],
      hpHistory,
      items: defaultItems,
      generatedAt: new Date().toISOString(),
      isRematchReady: true,
    };
  }, [reportData, sessionState, documentData]);

  // 2. Chức năng Xuất file Markdown
  const handleDownloadMarkdown = () => {
    let md = `# BÁO CÁO PHỤ LỤC CHẨN ĐOÁN (ACTIONABLE APPENDIX REPORT)\n`;
    md += `**Đề án:** ${report.documentTitle}\n`;
    md += `**Thời gian xuất:** ${new Date(report.generatedAt).toLocaleString('vi-VN')}\n`;
    md += `**Máu bảo tồn:** ${report.candidateHp}% | **Điểm tổng hợp:** ${report.overallScore}/100 | **Xếp loại:** ${report.grade}\n`;
    md += `**Tỷ lệ phòng thủ thành công:** ${report.defenseSuccessRate}%\n\n`;

    md += `---\n\n`;
    md += `## I. ĐIỂM SÁNG PHÒNG THỦ\n`;
    report.strengthsSummary.forEach((s) => (md += `- ✅ ${s}\n`));
    md += `\n`;

    md += `## II. RỦI RO & LỖ HỔNG TRỌNG YẾU\n`;
    report.criticalRisksSummary.forEach((r) => (md += `- ⚠️ ${r}\n`));
    md += `\n`;

    md += `## III. BẢNG ĐỐI SOÁT 3 CỘT (ACTIONABLE MATRIX)\n\n`;
    md += `| Lượt | Giám khảo & Câu hỏi | Lỗ hổng bị bóc trần / Lỗi logic | Đề xuất sửa Slide & Luận điểm bổ sung |\n`;
    md += `|:----:|:-------------------|:--------------------------------|:-------------------------------------|\n`;

    report.items.forEach((item) => {
      const q = item.question.replace(/\n/g, ' ').replace(/\|/g, '\\|');
      const cleanW = item.weaknessIdentified
        .replace(/\s*\(Q=\d+[^)]*\)/gi, '')
        .replace(/\s*Hệ số:\s*[\d.]+x/gi, '')
        .replace(/\s*Trừ\s+(?:nhẹ\s+)?\d+\s+HP\.?/gi, '')
        .trim();
      const w = (cleanW || item.weaknessIdentified).replace(/\n/g, ' ').replace(/\|/g, '\\|');
      let p = `${item.recommendedSlideTitle ? `**${item.recommendedSlideTitle}:** ` : ''}${item.slideActionProposal}`;
      if (item.juryIntent) {
        p += `<br/><br/>🎯 **Ý đồ thẩm định:** _${item.juryIntent}_`;
      }
      if (item.slideStructureBullets && item.slideStructureBullets.length > 0) {
        p += `<br/><br/>📐 **Cấu trúc Slide:**<br/>${item.slideStructureBullets.map((b) => `• ${b}`).join('<br/>')}`;
      }
      if (item.actionSteps && item.actionSteps.length > 0) {
        p += `<br/><br/>🚀 **3 Bước hành động trong 48h:**<br/>${item.actionSteps.map((s) => `• ${s}`).join('<br/>')}`;
      }
      if (item.winningResponse || item.sampleDefenseArgument) {
        const winning = item.winningResponse || item.sampleDefenseArgument;
        p += `<br/><br/>✅ **Câu trả lời chuẩn mực:** _"${winning?.replace(/\n/g, ' ')}"_`;
      }
      p = p.replace(/\n/g, ' ').replace(/\|/g, '\\|');
      md += `| ${item.turnIndex} | **${item.bossName}**<br/>_${item.topic}_<br/>${q} | ${item.fallacyType ? `*[${item.fallacyType}]*<br/>` : ''}${w} | ${p} |\n`;
    });

    md += `\n---\n`;
    md += `*Báo cáo được khởi tạo tự động bởi PitchArena Studio.*\n`;

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PitchArena-Appendix-Report-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 3. Chức năng In / Xuất PDF
  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div className="flex flex-col gap-6 animate-fadeIn pb-12 font-mono text-[#1C1917]">
      {/* 1. Header Báo cáo & Hành động */}
      <div className="p-6 rounded-2xl bg-[#FFFFFF] border border-[#D97706]/30 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="font-pixel text-xs font-bold bg-[#FEF3C7] text-[#92400E] border border-[#F59E0B]/50 px-3 py-1 rounded-full shadow-xs">
              BƯỚC 05 // TỔNG KẾT & PHÚC KHẢO ĐỀ TÀI
            </span>
            <span className="font-mono text-xs text-[#78716C]">
              Mã phiên: {report.sessionId.slice(0, 14)}
            </span>
          </div>
          <h2 className="font-headline text-2xl font-black text-[#1C1917] tracking-tight mt-2 uppercase">
            BÁO CÁO PHỤ LỤC CHẨN ĐOÁN (ACTIONABLE APPENDIX)
          </h2>
          <p className="font-sans text-xs text-[#57534E] mt-1">
            Đề tài: <strong className="text-[#1C1917] font-bold">{report.documentTitle}</strong> — Xuất đối soát 3 cột chuẩn bị slide bảo vệ trước Hội đồng thật.
          </p>
        </div>

        {/* Nút Xuất file & Tái đấu */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={handleDownloadMarkdown}
            className="px-4 py-2.5 bg-[#FAF8F5] text-[#1C1917] font-mono text-xs font-bold border border-[#D97706]/35 rounded-xl shadow-xs hover:bg-[#FEF3C7] hover:text-[#92400E] active:translate-x-0.5 flex items-center gap-2 transition-all cursor-pointer"
            title="Tải về file Markdown .md"
          >
            <Download className="w-4 h-4 text-[#D97706]" />
            <span>TẢI BÁO CÁO (.MD)</span>
          </button>

          <button
            type="button"
            onClick={handlePrintPdf}
            className="px-4 py-2.5 bg-[#FAF8F5] text-[#1C1917] font-mono text-xs font-bold border border-[#D97706]/35 rounded-xl shadow-xs hover:bg-[#FEF3C7] hover:text-[#92400E] active:translate-x-0.5 flex items-center gap-2 transition-all cursor-pointer"
            title="In hoặc lưu dạng PDF"
          >
            <Printer className="w-4 h-4 text-[#B45309]" />
            <span>IN / XUẤT PDF</span>
          </button>

          <button
            type="button"
            onClick={onRematch}
            className="px-5 py-2.5 bg-[#B45309] hover:bg-[#92400E] text-white font-pixel text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs rounded-xl transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5 text-white" />
            <span>[ ↺ TÁI ĐẤU LẬP TỨC ]</span>
          </button>
        </div>
      </div>

      {/* 2. Bảng Điểm Tổng Hợp (Executive Scoreboard) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Card 1: Máu Còn Lại */}
        <div className="p-5 rounded-2xl bg-[#FFFFFF] border border-[#D97706]/30 shadow-xs flex flex-col justify-between">
          <span className="font-headline text-[11px] text-[#78716C] font-bold uppercase tracking-wider">
            THANH MÁU BẢO TỒN (HP)
          </span>
          <div className="flex items-baseline gap-2 my-2">
            <span
              className={`font-headline text-3xl font-black ${
                report.candidateHp <= 20
                  ? 'text-rose-700'
                  : report.candidateHp <= 50
                  ? 'text-amber-700'
                  : 'text-emerald-700'
              }`}
            >
              {report.candidateHp}%
            </span>
            <span className="font-mono text-xs text-[#78716C] font-bold">
              {report.passed ? 'AN TOÀN' : 'CHẠM SÀN'}
            </span>
          </div>
          <div className="w-full h-2.5 bg-[#FAF8F5] border border-[#D97706]/25 rounded-full overflow-hidden p-0.5">
            <div
              className={`h-full rounded-full transition-all ${
                report.candidateHp <= 20
                  ? 'bg-rose-500'
                  : report.candidateHp <= 50
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.max(0, Math.min(100, report.candidateHp))}%` }}
            />
          </div>
        </div>

        {/* Card 2: Điểm MAD Chamber */}
        <div className="p-5 rounded-2xl bg-[#FFFFFF] border border-[#D97706]/30 shadow-xs flex flex-col justify-between">
          <span className="font-headline text-[11px] text-[#78716C] font-bold uppercase tracking-wider">
            ĐIỂM MAD CHAMBER
          </span>
          <div className="flex items-baseline gap-2 my-2">
            <span className="font-headline text-3xl font-black text-[#1C1917]">
              {report.overallScore}
            </span>
            <span className="font-mono text-xs text-[#78716C] font-bold">/ 100 ĐIỂM</span>
          </div>
          <span className="text-xs font-sans text-[#78716C]">
            Tổng hợp Trọng tâm + Căn cứ + Cầu thị
          </span>
        </div>

        {/* Card 3: Tỷ Lệ Phòng Thủ Thành Công */}
        <div className="p-5 rounded-2xl bg-[#FFFFFF] border border-[#D97706]/30 shadow-xs flex flex-col justify-between">
          <span className="font-headline text-[11px] text-[#78716C] font-bold uppercase tracking-wider">
            TỶ LỆ PHÒNG THỦ THÀNH CÔNG
          </span>
          <div className="flex items-baseline gap-2 my-2">
            <span className="font-headline text-3xl font-black text-emerald-700">
              {report.defenseSuccessRate}%
            </span>
            <span className="font-mono text-xs text-[#78716C] font-bold">
              ({report.totalTurns} lượt đối chất)
            </span>
          </div>
          <span className="text-xs font-sans text-[#78716C]">
            Số lượt không bị trừ máu hoặc được hồi máu
          </span>
        </div>

        {/* Card 4: Xếp Loại Chung Cuộc */}
        <div className="p-5 rounded-2xl bg-[#FFFFFF] border border-[#D97706]/30 shadow-xs flex flex-col justify-between">
          <span className="font-headline text-[11px] text-[#78716C] font-bold uppercase flex items-center gap-1.5 tracking-wider">
            <Award className="w-4 h-4 text-[#D97706]" />
            KẾT QUẢ ĐỐI CHẤT
          </span>
          <div className="my-2">
            <span className="font-headline text-sm font-black text-[#1C1917] block tracking-tight">
              {report.grade}
            </span>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-xs font-bold">
            {report.passed ? (
              <span className="text-emerald-800 flex items-center gap-1.5 font-pixel text-[10px]">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                VƯỢT QUA SÀN ĐẤU TRƯỜNG
              </span>
            ) : (
              <span className="text-rose-800 flex items-center gap-1.5 font-pixel text-[10px]">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                CẦN TÁI ĐẤU & BỔ SUNG SLIDE
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 3. Biểu đồ biến thiên máu theo từng lượt đối chất */}
      <HpTimelineChart hpHistory={report.hpHistory} shieldFloor={20} />

      {/* 4. Khối Điểm Sáng & Rủi Ro Trọng Yếu */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Điểm sáng */}
        <div className="p-5 rounded-2xl bg-[#FFFFFF] border border-emerald-300 shadow-xs">
          <h3 className="font-headline font-bold text-xs text-emerald-800 flex items-center gap-2 mb-3 uppercase tracking-wide">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>ĐIỂM SÁNG PHÒNG THỦ & LUẬN CỨ VỮNG CHẮC</span>
          </h3>
          <ul className="space-y-2 text-xs text-[#57534E] font-sans">
            {report.strengthsSummary.map((str, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>{str}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Lỗ hổng cần hoàn thiện */}
        <div className="p-5 rounded-2xl bg-[#FFFFFF] border border-rose-300 shadow-xs">
          <h3 className="font-headline font-bold text-xs text-rose-800 flex items-center gap-2 mb-3 uppercase tracking-wide">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>CẢNH BÁO LỖ HỔNG TRỌNG YẾU TRƯỚC GIỜ G</span>
          </h3>
          <ul className="space-y-2 text-xs text-[#57534E] font-sans">
            {report.criticalRisksSummary.map((risk, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="text-rose-600 font-bold">⚠</span>
                <span>{risk}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 5. Bảng Phụ Lục 3 Cột Hành Động */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="font-headline font-black text-lg text-[#1C1917] uppercase tracking-tight flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-[#D97706]" />
            <span>BẢNG ĐỐI SOÁT PHỤ LỤC 3 CỘT (ACTIONABLE APPENDIX MATRIX)</span>
          </h3>
          <span className="font-mono text-xs text-[#78716C] font-bold">
            Tổng cộng {report.items.length} mục chẩn đoán
          </span>
        </div>

        <AppendixTable items={report.items} />
      </div>

      {/* 6. Footer Actions */}
      <div className="p-5 rounded-2xl bg-[#FFFFFF] border border-[#D97706]/30 shadow-xs flex flex-wrap items-center justify-between gap-4 mt-2">
        <button
          type="button"
          onClick={onResetToStep1}
          className="px-5 py-3 border border-[#D97706]/35 bg-[#FAF8F5] text-[#1C1917] font-mono text-xs font-bold hover:bg-[#FEF3C7] hover:text-[#92400E] flex items-center gap-2 cursor-pointer rounded-xl transition-all shadow-xs"
        >
          <RotateCcw className="w-4 h-4 text-[#D97706]" />
          <span>NẠP ĐỀ TÀI KHÁC (BƯỚC 01)</span>
        </button>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onRematch}
            className="px-6 py-3 bg-[#B45309] hover:bg-[#92400E] text-white font-pixel font-bold text-xs flex items-center gap-2 cursor-pointer shadow-xs rounded-xl transition-all"
          >
            <Play className="w-4 h-4 fill-white text-white" />
            <span>BẮT ĐẦU VÒNG TÁI ĐẤU MỚI (BƯỚC 02) →</span>
          </button>
        </div>
      </div>
    </div>
  );
};
