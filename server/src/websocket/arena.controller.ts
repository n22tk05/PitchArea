import { Controller, Get, Param, NotFoundException, Header } from '@nestjs/common';
import { ArenaFsmService } from '../domain/fsm/arena-fsm.service';
import { DocumentService } from '../document/document.service';
import { AppendixGeneratorService } from '../domain/reporting/appendix-generator.service';
import { SessionPersistenceService } from '../adapters/db/session-persistence.service';
import { AppendixReport } from '@pitcharena/shared';

@Controller('api/arena')
export class ArenaController {
  constructor(
    private readonly fsmService: ArenaFsmService,
    private readonly documentService: DocumentService,
    private readonly appendixGeneratorService: AppendixGeneratorService,
    private readonly sessionPersistenceService: SessionPersistenceService
  ) {}

  /**
   * Lấy Báo cáo Phụ lục Hành động dạng JSON
   */
  @Get('sessions/:sessionId/report')
  getReport(@Param('sessionId') sessionId: string): AppendixReport {
    // 1. Kiểm tra trong kho lưu trữ persistence
    const savedReport = this.sessionPersistenceService.getReport(sessionId);
    if (savedReport) return savedReport;

    // 2. Nếu chưa có, kiểm tra session đang hoạt động
    const session = this.fsmService.getSession(sessionId);
    if (!session) {
      throw new NotFoundException(`Không tìm thấy phiên đấu [${sessionId}].`);
    }

    const doc = this.documentService.getDocument(session.documentId);
    const report = this.appendixGeneratorService.generateReport(
      session,
      doc?.filename || 'Đề án Khởi nghiệp Sinh viên'
    );
    this.sessionPersistenceService.saveReport(sessionId, report);
    return report;
  }

  /**
   * Xuất Báo cáo Phụ lục Hành động dạng Markdown (.md)
   */
  @Get('sessions/:sessionId/report/markdown')
  @Header('Content-Type', 'text/markdown; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="appendix-report.md"')
  getReportMarkdown(@Param('sessionId') sessionId: string): string {
    const report = this.getReport(sessionId);
    return this.convertReportToMarkdown(report);
  }

  /**
   * Chuyển đổi AppendixReport sang định dạng Markdown chuẩn đẹp
   */
  private convertReportToMarkdown(report: AppendixReport): string {
    let md = `# BÁO CÁO PHỤ LỤC CHẨN ĐOÁN (ACTIONABLE APPENDIX REPORT)\n`;
    md += `**Đề án:** ${report.documentTitle || 'Khởi nghiệp Sinh viên'}\n`;
    md += `**Thời gian xuất:** ${new Date(report.generatedAt).toLocaleString('vi-VN')}\n`;
    md += `**Máu bảo tồn:** ${report.candidateHp}% | **Điểm tổng kết:** ${report.overallScore}/100 | **Xếp loại:** ${report.grade}\n`;
    md += `**Tỷ lệ phòng thủ thành công:** ${report.defenseSuccessRate}% (${report.passed ? 'ĐẠT YÊU CẦU' : 'CẦN HOÀN THIỆN'})\n\n`;

    md += `---\n\n`;
    md += `## I. ĐIỂM SÁNG PHÒNG THỦ\n`;
    report.strengthsSummary.forEach((s) => {
      md += `- ✅ ${s}\n`;
    });
    md += `\n`;

    md += `## II. RỦI RO & LỖ HỔNG TRỌNG YẾU BỊ BÓC TRẦN\n`;
    report.criticalRisksSummary.forEach((r) => {
      md += `- ⚠️ ${r}\n`;
    });
    md += `\n`;

    md += `## III. BẢNG PHỤ LỤC ĐỐI SOÁT 3 CỘT (ACTIONABLE MATRIX)\n\n`;
    md += `| Lượt | Giám khảo & Câu hỏi | Lỗ hổng bị bóc trần / Lỗi logic | Đề xuất sửa Slide & Luận điểm bổ sung |\n`;
    md += `|:----:|:-------------------|:--------------------------------|:-------------------------------------|\n`;

    report.items.forEach((item) => {
      const q = item.question.replace(/\n/g, ' ').replace(/\|/g, '\\|');
      const w = item.weaknessIdentified.replace(/\n/g, ' ').replace(/\|/g, '\\|');
      const p = `${item.recommendedSlideTitle ? `**${item.recommendedSlideTitle}:** ` : ''}${item.slideActionProposal}`.replace(/\n/g, ' ').replace(/\|/g, '\\|');
      md += `| ${item.turnIndex} | **${item.bossName}**<br/>_${item.topic}_<br/>${q} | ${item.fallacyType ? `🔴 *[${item.fallacyType}]*<br/>` : ''}${w} | ${p} |\n`;
    });

    md += `\n---\n`;
    md += `*Báo cáo được khởi tạo tự động bởi PitchArena Studio (Realtime AI Voice Defense Simulator).*\n`;
    return md;
  }
}
