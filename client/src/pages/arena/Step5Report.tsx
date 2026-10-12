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
  Activity,
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
      if (item.sampleDefenseArgument) {
        const header = item.isDocxGrounded
          ? '<br/><br/>💡 **Câu trả lời mẫu (từ tài liệu):** '
          : '<br/><br/>⚠️ **Tài liệu chưa có — Đề xuất bổ sung:** ';
        p += `${header}_"${item.sampleDefenseArgument.replace(/\n/g, ' ')}"_`;
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
    <div className="flex flex-col gap-6 animate-fadeIn pb-12">
      {/* 1. Header Báo cáo & Hành động */}
      <div className="border-2 border-black bg-white p-5 shadow-[4px_4px_0px_#000] flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold bg-black text-white px-2 py-0.5">
              BƯỚC 05 // TỔNG KẾT & PHÚC KHẢO ĐỀ TÀI
            </span>
            <span className="font-mono text-[11px] text-neutral-500">
              Mã phiên: {report.sessionId.slice(0, 14)}
            </span>
          </div>
          <h2 className="font-headline text-2xl font-black text-black tracking-tight mt-1.5 uppercase">
            BÁO CÁO PHỤ LỤC CHẨN ĐOÁN (ACTIONABLE APPENDIX)
          </h2>
          <p className="font-sans text-xs text-neutral-600 mt-0.5">
            Đề tài: <strong>{report.documentTitle}</strong> — Xuất đối soát 3 cột chuẩn bị slide bảo vệ trước Hội đồng thật.
          </p>
        </div>

        {/* Nút Xuất file & Tái đấu */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleDownloadMarkdown}
            className="px-3 py-2 bg-white text-black font-mono text-xs font-bold border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-neutral-100 active:translate-x-0.5 active:translate-y-0.5 flex items-center gap-1.5 cursor-pointer"
            title="Tải về file Markdown .md"
          >
            <Download className="w-3.5 h-3.5" />
            <span>TẢI BÁO CÁO (.MD)</span>
          </button>

          <button
            type="button"
            onClick={handlePrintPdf}
            className="px-3 py-2 bg-white text-black font-mono text-xs font-bold border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-neutral-100 active:translate-x-0.5 active:translate-y-0.5 flex items-center gap-1.5 cursor-pointer"
            title="In hoặc lưu dạng PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>IN / XUẤT PDF</span>
          </button>

          <button
            type="button"
            onClick={onRematch}
            className="px-4 py-2 bg-black text-white font-mono text-xs font-bold border-2 border-black shadow-[3px_3px_0px_#eab308] hover:bg-neutral-800 active:translate-x-0.5 active:translate-y-0.5 flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            <span>[ ↺ TÁI ĐẤU LẬP TỨC ]</span>
          </button>
        </div>
      </div>

      {/* 2. Bảng Điểm Tổng Hợp (Executive Scoreboard) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Card 1: Máu Còn Lại */}
        <div className="border-2 border-black bg-white p-4 shadow-[3px_3px_0px_#000] flex flex-col justify-between">
          <span className="font-mono text-[10px] text-neutral-500 font-bold uppercase">
            THANH MÁU BẢO TỒN (HP)
          </span>
          <div className="flex items-baseline gap-2 my-1">
            <span
              className={`font-mono text-3xl font-black ${
                report.candidateHp <= 20
                  ? 'text-rose-600'
                  : report.candidateHp <= 50
                  ? 'text-amber-500'
                  : 'text-emerald-600'
              }`}
            >
              {report.candidateHp}%
            </span>
            <span className="font-mono text-xs text-neutral-500">
              {report.passed ? 'AN TOÀN' : 'CHẠM SÀN'}
            </span>
          </div>
          <div className="w-full h-2 bg-neutral-200 border border-black overflow-hidden">
            <div
              className={`h-full ${
                report.candidateHp <= 20
                  ? 'bg-rose-500'
                  : report.candidateHp <= 50
                  ? 'bg-amber-400'
                  : 'bg-emerald-400'
              }`}
              style={{ width: `${Math.max(0, Math.min(100, report.candidateHp))}%` }}
            />
          </div>
        </div>

        {/* Card 2: Điểm MAD Chamber */}
        <div className="border-2 border-black bg-white p-4 shadow-[3px_3px_0px_#000] flex flex-col justify-between">
          <span className="font-mono text-[10px] text-neutral-500 font-bold uppercase">
            ĐIỂM MAD CHAMBER
          </span>
          <div className="flex items-baseline gap-2 my-1">
            <span className="font-mono text-3xl font-black text-black">
              {report.overallScore}
            </span>
            <span className="font-mono text-xs text-neutral-500">/ 100 ĐIỂM</span>
          </div>
          <span className="text-[10px] font-sans text-neutral-600">
            Tổng hợp Trọng tâm + Căn cứ + Cầu thị
          </span>
        </div>

        {/* Card 3: Tỷ Lệ Phòng Thủ Thành Công */}
        <div className="border-2 border-black bg-white p-4 shadow-[3px_3px_0px_#000] flex flex-col justify-between">
          <span className="font-mono text-[10px] text-neutral-500 font-bold uppercase">
            TỶ LỆ PHÒNG THỦ THÀNH CÔNG
          </span>
          <div className="flex items-baseline gap-2 my-1">
            <span className="font-mono text-3xl font-black text-black">
              {report.defenseSuccessRate}%
            </span>
            <span className="font-mono text-xs text-neutral-500">
              ({report.totalTurns} lượt đối chất)
            </span>
          </div>
          <span className="text-[10px] font-sans text-neutral-600">
            Số lượt không bị trừ máu hoặc được hồi máu
          </span>
        </div>

        {/* Card 4: Xếp Loại Chung Cuộc */}
        <div
          className={`border-2 border-black p-4 shadow-[3px_3px_0px_#000] flex flex-col justify-between ${
            report.passed ? 'bg-amber-50' : 'bg-rose-50'
          }`}
        >
          <span className="font-mono text-[10px] text-neutral-600 font-bold uppercase flex items-center gap-1">
            <Award className="w-3.5 h-3.5 text-black" />
            KẾT QUẢ ĐỐI CHẤT
          </span>
          <div className="my-1">
            <span className="font-mono text-sm font-black text-black block tracking-tight">
              {report.grade}
            </span>
          </div>
          <div className="flex items-center gap-1 font-mono text-[11px] font-bold">
            {report.passed ? (
              <span className="text-emerald-700 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                VƯỢT QUA SÀN ĐẤU TRƯỜNG
              </span>
            ) : (
              <span className="text-rose-700 flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" />
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
        <div className="border-2 border-black bg-emerald-50/50 p-4 shadow-[3px_3px_0px_#000]">
          <h3 className="font-mono font-bold text-xs text-emerald-900 flex items-center gap-1.5 mb-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>ĐIỂM SÁNG PHÒNG THỦ & LUẬN CỨ VỮNG CHẮC</span>
          </h3>
          <ul className="space-y-1.5 text-xs text-neutral-800 font-sans">
            {report.strengthsSummary.map((str, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>{str}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Lỗ hổng cần hoàn thiện */}
        <div className="border-2 border-black bg-rose-50/50 p-4 shadow-[3px_3px_0px_#000]">
          <h3 className="font-mono font-bold text-xs text-rose-900 flex items-center gap-1.5 mb-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>CẢNH BÁO LỖ HỔNG TRỌNG YẾU TRƯỚC GIỜ G</span>
          </h3>
          <ul className="space-y-1.5 text-xs text-neutral-800 font-sans">
            {report.criticalRisksSummary.map((risk, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-rose-600 font-bold">⚠</span>
                <span>{risk}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 5. Bảng Phụ Lục 3 Cột Hành Động (Actionable Matrix) */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="font-headline font-black text-lg text-black uppercase tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-black" />
            <span>BẢNG ĐỐI SOÁT PHỤ LỤC 3 CỘT (ACTIONABLE APPENDIX MATRIX)</span>
          </h3>
          <span className="font-mono text-xs text-neutral-500">
            Tổng cộng {report.items.length} mục chẩn đoán
          </span>
        </div>

        <AppendixTable items={report.items} />
      </div>

      {/* 6. Footer Actions */}
      <div className="border-2 border-black bg-neutral-50 p-4 shadow-[3px_3px_0px_#000] flex flex-wrap items-center justify-between gap-4 mt-2">
        <button
          type="button"
          onClick={onResetToStep1}
          className="px-4 py-2 border-2 border-black bg-white font-mono text-xs font-bold hover:bg-neutral-100 flex items-center gap-1.5 cursor-pointer shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>NẠP ĐỀ TÀI KHÁC (BƯỚC 01)</span>
        </button>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onRematch}
            className="px-6 py-2.5 bg-black text-white font-mono font-bold text-xs border-2 border-black shadow-[3px_3px_0px_#eab308] hover:bg-neutral-800 active:translate-x-0.5 active:translate-y-0.5 flex items-center gap-2 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-amber-400 text-amber-400" />
            <span>BẮT ĐẦU VÒNG TÁI ĐẤU MỚI (BƯỚC 02) →</span>
          </button>
        </div>
      </div>
    </div>
  );
};
