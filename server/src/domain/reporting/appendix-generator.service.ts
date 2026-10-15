import { Injectable, Logger, Optional } from '@nestjs/common';
import {
  AppendixItem,
  AppendixReport,
  ArenaSessionState,
  CombatDifficulty,
  DocumentAnalysisResult,
  HpHistoryPoint,
  JuryBossId,
  VerdictResult,
  BOSS_TO_SECTION_MAP,
  BusinessSectionLabel,
} from '@pitcharena/shared';
import { DocumentService } from '../../document/document.service';

@Injectable()
export class AppendixGeneratorService {
  private readonly logger = new Logger(AppendixGeneratorService.name);

  constructor(
    @Optional() private readonly documentService?: DocumentService
  ) {}

  /**
   * Sinh Báo cáo Phụ lục Hành động (Diagnostic Actionable Appendix Report)
   * Phân tích đối soát 3 cột: Câu hỏi Giám khảo - Lỗ hổng Bị Bóc Trần - Đề xuất Sửa Slide
   */
  public generateReport(
    session: ArenaSessionState,
    documentTitle = 'Đề án Khởi nghiệp Sinh viên'
  ): AppendixReport {
    this.logger.log(
      `[AppendixGenerator] 📊 Bắt đầu sinh Báo cáo Phụ lục cho Session [${session.sessionId}] (Máu kết thúc: ${session.candidateHp}%)`
    );

    const doc = this.documentService?.getDocument(session.documentId);
    const difficulty = session.config?.difficulty || CombatDifficulty.NORMAL;
    const resolvedDocTitle = doc?.filename || documentTitle;

    const verdicts = session.verdictHistory || [];
    const transcript = session.transcriptHistory || [];

    // 1. Phân rã các lượt hỏi - đáp
    const items: AppendixItem[] = [];
    const hpHistory: HpHistoryPoint[] = [{
      turn: 0,
      bossId: session.activeBossId,
      hp: 100,
      hpDelta: 0,
      topic: 'Khởi đầu trận đấu',
    }];

    let runningHp = 100;

    // Tìm các câu hỏi của Boss và câu trả lời thí sinh
    const bossQuestions: Array<{ bossId: JuryBossId; text: string; timestamp: string }> = [];
    const candidateAnswers: Array<{ text: string; timestamp: string }> = [];

    transcript.forEach((entry) => {
      if (entry.sender === 'BOSS') {
        bossQuestions.push({
          bossId: entry.bossId || session.activeBossId,
          text: entry.text,
          timestamp: entry.timestamp,
        });
      } else if (entry.sender === 'CANDIDATE') {
        candidateAnswers.push({
          text: entry.text,
          timestamp: entry.timestamp,
        });
      }
    });

    const totalRounds = Math.max(verdicts.length, bossQuestions.length);

    for (let i = 0; i < totalRounds; i++) {
      const turnIndex = i + 1;
      const verdict = verdicts[i];
      const bossQ = bossQuestions[i];
      const candidateAns = candidateAnswers[i];

      const bossId = verdict?.bossId || bossQ?.bossId || session.activeBossId;
      const questionText = bossQ?.text || this.cleanReasonText(verdict?.reason) || `Câu hỏi đối chất lượt ${turnIndex}`;
      const answerText = candidateAns?.text || 'Thí sinh không phản hồi hoặc phản hồi quá ngắn.';
      let hpDelta = verdict ? verdict.hpDelta : 0;

      // Đảm bảo nếu lượt này thí sinh không phản hồi hoặc bị bỏ qua thì luôn có mức phạt âm
      const isUnanswered =
        answerText.includes('không phản hồi') ||
        answerText.includes('quá ngắn') ||
        answerText.includes('bỏ qua') ||
        answerText.includes('Kết thúc đối chất sớm');

      if (isUnanswered && hpDelta >= 0) {
        hpDelta =
          difficulty === CombatDifficulty.EASY
            ? -15
            : difficulty === CombatDifficulty.NORMAL
            ? -20
            : -25;
      }

      runningHp = Math.max(0, Math.min(100, runningHp + hpDelta));

      hpHistory.push({
        turn: turnIndex,
        bossId,
        hp: runningHp,
        hpDelta,
        topic: verdict?.topic || 'Đối chất chuyên môn',
      });

      // Xác định mức độ nghiêm trọng
      let severity: 'CRITICAL' | 'WARNING' | 'GOOD' = 'GOOD';
      if (hpDelta <= -10) {
        severity = 'CRITICAL';
      } else if (hpDelta < 0) {
        severity = 'WARNING';
      }

      // Xác định lỗ hổng và hướng sửa slide bám sát tài liệu docx và cấp độ khó
      const diagnosis = this.diagnoseTurn(
        bossId,
        questionText,
        answerText,
        verdict,
        difficulty,
        doc
      );

      // Làm sạch lý do: Bỏ toàn bộ vết tích kỹ thuật dạng (Q=..., Hệ số: ...x), Trừ ... HP
      const cleanVerdictReason = this.cleanReasonText(verdict?.reason);
      const weaknessIdentified = cleanVerdictReason || diagnosis.weakness;

      items.push({
        turnIndex,
        bossId,
        bossName: this.getBossDisplayName(bossId),
        topic: verdict?.topic || diagnosis.fallbackTopic,
        question: questionText,
        candidateAnswer: answerText,
        weaknessIdentified,
        fallacyType: diagnosis.fallacy,
        slideActionProposal: diagnosis.proposal,
        recommendedSlideTitle: diagnosis.slideTitle,
        sampleDefenseArgument: diagnosis.sampleDefenseArgument,
        isDocxGrounded: diagnosis.isDocxGrounded,
        hpImpact: hpDelta,
        score: verdict?.score || {
          directness: hpDelta >= 0 ? 80 : 45,
          factualBacking: hpDelta >= 0 ? 75 : 40,
          intellectualHonesty: hpDelta >= 0 ? 85 : 50,
          overallScore: hpDelta >= 0 ? 80 : 45,
        },
        severity,
      });
    }

    // Nếu không có lượt nào trong transcript (ví dụ vào thẳng bước 5), tạo các mục chẩn đoán mặc định phù hợp độ khó
    if (items.length === 0) {
      items.push(...this.getDefaultDiagnosticItems(session.activeBossId, difficulty, doc));
    }

    // 2. Tính toán tổng hợp
    const finalHp = session.candidateHp;
    const passed = finalHp > (session.config?.pedagogicalShieldFloor ?? 20);

    const scores = items.map((it) => it.score.overallScore);
    const overallScore = Math.round(
      scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 60
    );

    const goodTurns = items.filter((it) => it.severity === 'GOOD').length;
    const defenseSuccessRate = Math.round((goodTurns / items.length) * 100);

    let grade: AppendixReport['grade'] = 'ĐẠT YÊU CẦU (PASS)';
    if (passed && finalHp >= 80 && overallScore >= 80) {
      grade = 'XUẤT SẮC (PASS+)';
    } else if (passed && finalHp >= 50) {
      grade = 'ĐẠT YÊU CẦU (PASS)';
    } else if (passed) {
      grade = 'CẦN HOÀN THIỆN (REVISE)';
    } else {
      grade = 'RỦI RO CAO (HIGH RISK)';
    }

    const strengthsSummary = this.extractStrengths(items);
    const criticalRisksSummary = this.extractRisks(items);

    const report: AppendixReport = {
      sessionId: session.sessionId,
      documentId: session.documentId,
      documentTitle: resolvedDocTitle,
      candidateHp: finalHp,
      totalTurns: items.length,
      passed,
      overallScore,
      grade,
      defenseSuccessRate,
      strengthsSummary,
      criticalRisksSummary,
      hpHistory,
      items,
      generatedAt: new Date().toISOString(),
      isRematchReady: true,
    };

    this.logger.log(
      `[AppendixGenerator] ✅ Hoàn tất Báo cáo: Xếp loại=${grade}, Điểm=${overallScore}, Tỷ lệ thành công=${defenseSuccessRate}%, Số mục phụ lục=${items.length}`
    );

    return report;
  }

  /**
   * Làm sạch lý do: Loại bỏ hoàn toàn các thông số công thức (Q=..., Hệ số: ...x), Trừ ... HP
   */
  public cleanReasonText(text?: string): string {
    if (!text) return '';
    return text
      .replace(/\s*\(Q=\d+[^)]*\)/gi, '')
      .replace(/\s*Hệ số:\s*[\d.]+x/gi, '')
      .replace(/\s*Trừ\s+(?:nhẹ\s+)?\d+\s+HP\.?/gi, '')
      .replace(/\s*Thưởng hồi phục(?:\s+\+\d+\s+HP)?!?/gi, '')
      .replace(/\s*\[KÍCH HOẠT SÀN TÂN THỦ.*?\]/gi, '')
      .replace(/\s*\[CẢNH BÁO NGUY CẤP.*?\]/gi, '')
      .replace(/\s*\[COMEBACK SURGE.*?\]/gi, '')
      .replace(/\s*\(\s*\)/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private getBossDisplayName(bossId: JuryBossId): string {
    switch (bossId) {
      case JuryBossId.FINANCE_DRAGON:
        return 'GS. Vũ Hoàng (Tài chính & Dòng tiền)';
      case JuryBossId.TECH_SENTINEL:
        return 'TS. Lê Minh Trang (Kiến trúc & Công nghệ)';
      case JuryBossId.MARKET_SHARK:
        return 'Shark Trần Nam (Thị trường & Khách hàng)';
      case JuryBossId.RISK_STRATEGIST:
        return 'Chuyên gia Hoàng Nam (Rào cản & Rủi ro)';
      default:
        return 'Hội đồng Giám khảo';
    }
  }

  /**
   * Tìm kiếm câu văn hoặc thực thể số liệu liên quan trực tiếp từ tệp docx của người dùng.
   * Ưu tiên quét câu có từ khóa phù hợp; nếu không, lấy câu có nội dung thực tế nhất trong mục tương ứng.
   */
  private extractDocxEvidence(
    bossId: JuryBossId,
    doc?: DocumentAnalysisResult,
    questionText?: string
  ): { sentence: string; sectionTitle: string } | null {
    if (!doc || !doc.sections || doc.sections.length === 0) {
      return null;
    }

    const targetTypes = BOSS_TO_SECTION_MAP[bossId] || [];
    const relevantSections = doc.sections.filter((s) => targetTypes.includes(s.type));
    const sectionsToSearch = relevantSections.length > 0 ? relevantSections : doc.sections;

    const keywordsByBoss: Record<JuryBossId, string[]> = {
      [JuryBossId.FINANCE_DRAGON]: [
        'chi phí', 'giá', 'doanh thu', 'hòa vốn', 'ngân sách', 'lợi nhuận',
        'triệu', 'tỷ', 'đầu tư', 'vốn', 'tháng', 'burn rate', 'thu phí', 'kinh doanh'
      ],
      [JuryBossId.TECH_SENTINEL]: [
        'công nghệ', 'api', 'hệ thống', 'dữ liệu', 'kiến trúc', 'offline',
        'bản mẫu', 'mvp', 'độ trễ', 'máy chủ', 'bảo mật', 'thuật toán', 'mô hình', 'tính năng', 'phần mềm', 'ứng dụng'
      ],
      [JuryBossId.MARKET_SHARK]: [
        'khách hàng', 'người dùng', 'khảo sát', 'phỏng vấn', '%', 'nhu cầu',
        'thị trường', 'trả tiền', 'sử dụng', 'đăng ký', 'chuyển đổi', 'đối tượng', 'sinh viên', 'học sinh'
      ],
      [JuryBossId.RISK_STRATEGIST]: [
        'đối thủ', 'cạnh tranh', 'khác biệt', 'rào cản', 'lợi thế', 'rủi ro',
        'lộ trình', 'thời gian', 'pháp lý', 'độc quyền', 'moat', 'kế hoạch', 'phát triển'
      ],
    };

    const keywords = keywordsByBoss[bossId] || ['dự án', 'giải pháp', 'hệ thống', 'người dùng'];

    // 0. Nếu câu hỏi có từ khóa cụ thể, thêm các từ khóa đó vào bộ lọc
    const questionKeywords: string[] = [];
    if (questionText) {
      const qWords = questionText
        .toLowerCase()
        .replace(/[?,.:;!]/g, '')
        .split(/\s+/)
        .filter((w) => w.length >= 3 && !['cho', 'của', 'trong', 'với', 'được', 'không', 'như', 'thế', 'nào', 'nhóm', 'thưa', 'thầy', 'cô'].includes(w));
      questionKeywords.push(...qWords.slice(0, 5));
    }

    // 1. Quét trong Entity Whitelist trước (những câu đã được thẩm định số liệu)
    if (doc.entityWhitelist && doc.entityWhitelist.length > 0) {
      for (const ent of doc.entityWhitelist) {
        if (targetTypes.length === 0 || targetTypes.includes(ent.sectionType)) {
          if (ent.contextSentence && ent.contextSentence.length >= 20) {
            const lowerSentence = ent.contextSentence.toLowerCase();
            const matchesQ = questionKeywords.some((qw) => lowerSentence.includes(qw));
            const matchesKw = keywords.some((kw) => lowerSentence.includes(kw));
            if (matchesQ || matchesKw) {
              const label = BusinessSectionLabel[ent.sectionType] || 'Đề án';
              return {
                sentence: ent.contextSentence.trim().replace(/^[-*#\s]+/, ''),
                sectionTitle: label,
              };
            }
          }
        }
      }
    }

    // 2. Quét trong nội dung từng Section tương ứng (ưu tiên khớp từ khóa câu hỏi hoặc từ khóa chuyên môn)
    for (const sec of sectionsToSearch) {
      if (!sec.content || sec.content.trim().length === 0) continue;
      const sentences = sec.content
        .split(/(?<=[.!?\n])\s+/)
        .map((s) => s.replace(/^[-*#\s]+/, '').trim())
        .filter((s) => s.length >= 20 && s.length <= 300 && !s.includes('Chưa phát hiện nội dung rõ ràng'));

      // Ưu tiên 2a: Khớp từ khóa câu hỏi của Giám khảo
      if (questionKeywords.length > 0) {
        for (const st of sentences) {
          const lower = st.toLowerCase();
          const matchQCount = questionKeywords.filter((qw) => lower.includes(qw)).length;
          if (matchQCount >= 1) {
            const label = sec.title || BusinessSectionLabel[sec.type] || 'Tài liệu đề án';
            return { sentence: st, sectionTitle: label };
          }
        }
      }

      // Ưu tiên 2b: Khớp từ khóa chuyên môn của Boss
      for (const st of sentences) {
        const lower = st.toLowerCase();
        const matchCount = keywords.filter((kw) => lower.includes(kw)).length;
        if (matchCount >= 1) {
          const label = sec.title || BusinessSectionLabel[sec.type] || 'Tài liệu đề án';
          return { sentence: st, sectionTitle: label };
        }
      }
    }

    // 3. Fallback thông minh: Lấy câu văn có nội dung đầy đủ và thực tế nhất từ Section tương ứng
    for (const sec of sectionsToSearch) {
      if (!sec.content || sec.content.trim().length === 0) continue;
      const sentences = sec.content
        .split(/(?<=[.!?\n])\s+/)
        .map((s) => s.replace(/^[-*#\s]+/, '').trim())
        .filter((s) => s.length >= 25 && s.length <= 250 && !s.includes('Chưa phát hiện nội dung'));
      if (sentences.length > 0) {
        const label = sec.title || BusinessSectionLabel[sec.type] || 'Tài liệu đề án';
        return { sentence: sentences[0], sectionTitle: label };
      }
    }

    // 4. Fallback cuối cùng: Lấy câu văn từ tổng thể tài liệu Word nếu có
    if (doc.markdownContent && doc.markdownContent.length > 50) {
      const allSentences = doc.markdownContent
        .split(/(?<=[.!?\n])\s+/)
        .map((s) => s.replace(/^[-*#\s]+/, '').trim())
        .filter((s) => s.length >= 30 && s.length <= 200 && !s.includes('#') && !s.includes('Chưa phát hiện'));
      if (allSentences.length > 0) {
        return { sentence: allSentences[0], sectionTitle: 'Bản thuyết minh đề án' };
      }
    }

    return null;
  }

  /**
   * Rút gọn và tinh chỉnh dẫn chứng từ tài liệu để câu trả lời mẫu ngắn gọn, súc tích
   */
  private cleanAndCompactEvidence(sentence: string): string {
    if (!sentence) return '';
    let clean = sentence.replace(/\\/g, '').replace(/["“”]/g, '').trim();
    // Nếu có dạng "Tiêu đề: Nội dung" -> lấy phần nội dung hoặc tiêu đề súc tích
    if (clean.includes(':')) {
      const parts = clean.split(':');
      if (parts[1] && parts[1].trim().length >= 15) {
        clean = parts[1].trim();
      }
    }
    // Rút ngắn tối đa 120 ký tự để người nói diễn đạt tự nhiên và đủ ý
    if (clean.length > 120) {
      const words = clean.split(/\s+/);
      clean = words.slice(0, 18).join(' ') + '...';
    }
    return clean;
  }

  /**
   * Phân loại bám sát Word:
   * TRƯỜNG HỢP 1: Trong Word ĐÃ CÓ dữ liệu/ý tưởng -> Gợi ý câu trả lời mẫu bám sát đề án, làm rõ và phát triển mở rộng ý tưởng để giải đáp cho Giám khảo.
   * TRƯỜNG HỢP 2: Trong Word CHƯA CÓ dữ liệu -> Đề xuất tìm kiếm, khảo sát & câu trả lời cầu thị tránh bị trừ điểm.
   */
  private generateGroundingAndSampleAnswer(
    bossId: JuryBossId,
    question: string,
    difficulty: CombatDifficulty,
    doc?: DocumentAnalysisResult
  ): {
    sampleDefenseArgument: string;
    isDocxGrounded: boolean;
    slideActionProposal: string;
    recommendedSlideTitle: string;
  } {
    const targetCustomer =
      doc?.foundationFacts?.targetCustomerType || 'người dùng mục tiêu';
    const evidence = this.extractDocxEvidence(bossId, doc, question);

    // =========================================================================
    // TRƯỜNG HỢP 1: TÀI LIỆU WORD ĐÃ CÓ DỮ LIỆU / Ý TƯỞNG (LÀM RÕ & PHÁT TRIỂN TIẾP)
    // =========================================================================
    if (evidence) {
      const compactEvidence = this.cleanAndCompactEvidence(evidence.sentence);
      let sampleText = '';
      let slideTitle = '';

      if (bossId === JuryBossId.FINANCE_DRAGON) {
        slideTitle = 'Slide Phụ lục F1: Bảng Dữ Liệu Chi Phí & Điểm Hòa Vốn (Từ Đề Án)';
        sampleText = `Thưa Thầy/Cô, trong bản thuyết minh tại mục "${evidence.sectionTitle}", nhóm đã nêu rõ: "${compactEvidence}".\n\nĐể làm rõ hơn và phát triển định hướng này cho Hội đồng:\n• Về cơ chế tài chính: Nhóm tối ưu hóa chi phí vận hành ở mức tối thiểu để duy trì sản phẩm qua 6 tháng đầu.\n• Về bước phát triển tiếp theo: Khi đạt mốc người dùng thử nghiệm ổn định, nhóm sẽ kích hoạt gói dịch vụ nâng cao để tự chủ dòng tiền.\n\n🎯 HƯỚNG DẪN TRẢ LỜI NGẮN GỌN (15s):\n• 0 - 5s: Dẫn ngay ý đã có trong đề án ("Theo đề án nhóm đã nêu...").\n• 5 - 15s: Làm rõ cách thức thực hiện và định hướng phát triển tiếp theo để giải tỏa thắc mắc của Giám khảo.`;
      } else if (bossId === JuryBossId.MARKET_SHARK) {
        slideTitle = 'Slide Phụ lục M1: Dữ Liệu Khảo Sát & Xác Thực Nhu Cầu Người Dùng (Từ Đề Án)';
        sampleText = `Thưa Thầy/Cô, về nhu cầu của ${targetCustomer}, trong bản thuyết minh tại mục "${evidence.sectionTitle}", nhóm đã phân tích: "${compactEvidence}".\n\nĐể làm rõ hơn thực tế triển khai:\n• Giải pháp của nhóm tập trung giải quyết đúng điểm nghẽn mà đối tượng thụ hưởng đang gặp phải so với cách làm thủ công cũ.\n• Về kế hoạch tiếp cận: Nhóm bắt đầu từ nhóm người dùng hạt giống thân thiết nhất để hoàn thiện trải nghiệm trước khi nhân rộng.\n\n🎯 HƯỚNG DẪN TRẢ LỜI NGẮN GỌN (15s):\n• 0 - 5s: Khẳng định đề án đã xác định nhu cầu này tại mục "${evidence.sectionTitle}".\n• 5 - 15s: Nêu rõ vì sao người dùng sẵn sàng chọn giải pháp của nhóm thay vì cách làm truyền thống.`;
      } else if (bossId === JuryBossId.TECH_SENTINEL) {
        slideTitle = 'Slide Phụ lục T2: Sơ Đồ Kiến Trúc & Cơ Chế Vận Hành Kỹ Thuật (Từ Đề Án)';
        sampleText = `Thưa Thầy/Cô, về mặt kỹ thuật, trong bản thuyết minh tại mục "${evidence.sectionTitle}", nhóm đã thiết kế: "${compactEvidence}".\n\nĐể làm rõ quy trình vận hành thực tế:\n• Cơ chế hoạt động: Nhóm kết hợp xử lý dữ liệu tại chỗ (cục bộ) và cơ chế đồng bộ nền để đảm bảo trải nghiệm người dùng luôn thông suốt.\n• Hướng phát triển công nghệ: Nhóm liên tục tối ưu thuật toán để giảm độ trễ và tăng tính ổn định trên các thiết bị phổ thông.\n\n🎯 HƯỚNG DẪN TRẢ LỜI NGẮN GỌN (15s):\n• 0 - 5s: Dẫn chứng giải pháp kỹ thuật đã nêu trong đề án.\n• 5 - 15s: Làm rõ quy trình hoạt động thực tế và cách nhóm kiểm soát chất lượng kỹ thuật.`;
      } else {
        slideTitle = 'Slide Phụ lục R3: Ma Trận Cạnh Tranh & Kế Hoạch Triển Khai (Từ Đề Án)';
        sampleText = `Thưa Thầy/Cô, về định hướng chiến lược, trong bản thuyết minh tại mục "${evidence.sectionTitle}", nhóm đã xác định: "${compactEvidence}".\n\nĐể bảo vệ giải pháp và phát triển bền vững:\n• Lợi thế cốt lõi: Nhóm bám sát trải nghiệm thực tế và sự linh hoạt của đội ngũ để tạo sự khác biệt so với các giải pháp hiện hữu.\n• Cam kết dài hạn: Các thành viên đã phân công nhiệm vụ cụ thể theo từng mốc thời gian trong lộ trình 6 tháng tới.\n\n🎯 HƯỚNG DẪN TRẢ LỜI NGẮN GỌN (15s):\n• 0 - 5s: Nêu thẳng điểm tựa đã có trong đề án.\n• 5 - 15s: Trình bày kế hoạch thực thi rõ ràng, chứng minh khả năng duy trì và nhân rộng của dự án.`;
      }

      return {
        isDocxGrounded: true,
        slideActionProposal: `Lấy nội dung đã có tại mục "${evidence.sectionTitle}" làm điểm tựa, bổ sung sơ đồ/số liệu trực quan lên Slide phụ lục để làm rõ và phát triển luận điểm trước Hội đồng.`,
        recommendedSlideTitle: slideTitle,
        sampleDefenseArgument: sampleText,
      };
    }

    // =========================================================================
    // TRƯỜNG HỢP 2: TÀI LIỆU WORD THỰC SỰ CHƯA CÓ NỘI DUNG VỀ ĐỀ TÀI NÀY
    // =========================================================================
    let missingGuidance = '';
    let missingSlideTitle = '';

    if (bossId === JuryBossId.FINANCE_DRAGON) {
      missingSlideTitle = 'Slide Phụ lục F1: Kế Hoạch Dự Toán Ngân Sách (Bổ Sung)';
      missingGuidance = `Trong tài liệu hiện chưa nêu dự toán chi phí chi tiết. Đề xuất nhóm bổ sung một bảng dự toán chi phí vận hành 6 tháng đầu và số lượng ${targetCustomer} cần đạt để cân đối dòng tiền.\n\n🎯 CÂU TRẢ LỜI MẪU CẦU THỊ KHI CHƯA CÓ SỐ LIỆU:\n"Thưa Thầy/Cô, hiện đề án đang ở giai đoạn thử nghiệm nên nhóm đang tạm ước tính chi phí tối thiểu theo quy mô sinh viên. Nhóm xin tiếp thu góp ý của Thầy/Cô và sẽ lập bảng dự toán chi tiết bổ sung trong 2 tuần tới."`;
    } else if (bossId === JuryBossId.MARKET_SHARK) {
      missingSlideTitle = 'Slide Phụ lục M1: Dữ Liệu Khảo Sát Người Dùng (Bổ Sung)';
      missingGuidance = `Trong tài liệu hiện chưa có số liệu khảo sát thực tế từ người dùng. Đề xuất nhóm bổ sung kết quả phỏng vấn 10-15 ${targetCustomer} và danh sách đăng ký dùng thử.\n\n🎯 CÂU TRẢ LỜI MẪU CẦU THỊ KHI CHƯA CÓ SỐ LIỆU:\n"Thưa Thầy/Cô, hiện nhóm mới ghi nhận phản hồi định tính qua phỏng vấn thử nghiệm. Nhóm xin tiếp thu và sẽ triển khai đo lường mức độ sẵn sàng đón nhận trên 20 khách hàng hạt giống ngay trong tháng này."`;
    } else if (bossId === JuryBossId.TECH_SENTINEL) {
      missingSlideTitle = 'Slide Phụ lục T2: Quy Trình Xử Lý Ngoại Lệ & Kỹ Thuật (Bổ Sung)';
      missingGuidance = `Trong tài liệu hiện chưa nêu phương án xử lý sự cố kỹ thuật. Đề xuất nhóm bổ sung sơ đồ xử lý ngoại lệ và cơ chế lưu trữ dữ liệu tạm thời.\n\n🎯 CÂU TRẢ LỜI MẪU CẦU THỊ KHI CHƯA CÓ SỐ LIỆU:\n"Thưa Thầy/Cô, giải pháp hiện tại đang ưu tiên luồng xử lý chính. Nhóm xin tiếp thu và sẽ bổ sung cơ chế lưu tạm dữ liệu tại chỗ (Local Cache) để bảo đảm trải nghiệm không bị đứt đoạn."`;
    } else {
      missingSlideTitle = 'Slide Phụ lục R3: Ma Trận Khác Biệt & Lộ Trình (Bổ Sung)';
      missingGuidance = `Trong tài liệu hiện chưa làm rõ điểm khác biệt và kế hoạch duy trì. Đề xuất nhóm lập bảng so sánh 1-2 tính năng vượt trội nhất và lộ trình phân công nhiệm vụ 6 tháng tới.\n\n🎯 CÂU TRẢ LỜI MẪU CẦU THỊ KHI CHƯA CÓ SỐ LIỆU:\n"Thưa Thầy/Cô, điểm khác biệt hiện tại của nhóm tập trung vào trải nghiệm tối ưu cho người dùng. Nhóm xin tiếp thu và sẽ lập bảng so sánh chi tiết với các giải pháp hiện có trên thị trường."`;
    }

    return {
      isDocxGrounded: false,
      slideActionProposal: `Tài liệu Word chưa có phần này. Cần khảo sát/tính toán thêm số liệu để bổ sung một Slide phụ lục mới giải tỏa thắc mắc của Ban giám khảo.`,
      recommendedSlideTitle: missingSlideTitle,
      sampleDefenseArgument: missingGuidance,
    };
  }

  /**
   * Chẩn đoán lỗ hổng và đề xuất slide cụ thể bám sát tài liệu docx và độ khó (Easy, Normal, Hardcore)
   */
  private diagnoseTurn(
    bossId: JuryBossId,
    question: string,
    answer: string,
    verdict?: VerdictResult,
    difficulty: CombatDifficulty = CombatDifficulty.NORMAL,
    doc?: DocumentAnalysisResult
  ): {
    fallbackTopic: string;
    weakness: string;
    fallacy: string | undefined;
    proposal: string;
    slideTitle: string;
    sampleDefenseArgument: string;
    isDocxGrounded: boolean;
  } {
    const isGoodTurn = (verdict?.hpDelta ?? 0) >= 0;

    const topicByBoss: Record<JuryBossId, string> = {
      [JuryBossId.FINANCE_DRAGON]: 'Tài chính & Dòng tiền Vận hành',
      [JuryBossId.TECH_SENTINEL]: 'Kiến trúc Kỹ thuật & Dự phòng',
      [JuryBossId.MARKET_SHARK]: 'Xác thực Nhu cầu & Khách hàng Mục tiêu',
      [JuryBossId.RISK_STRATEGIST]: 'Chiến lược Cạnh tranh & Rào cản Phòng thủ',
    };

    const fallacyByBoss: Record<JuryBossId, string> = {
      [JuryBossId.FINANCE_DRAGON]: 'Ảo tưởng dòng tiền ngoại sinh',
      [JuryBossId.TECH_SENTINEL]: 'Thiếu phương án dự phòng trải nghiệm người dùng',
      [JuryBossId.MARKET_SHARK]: 'Nhầm lẫn giữa khảo sát ý kiến và hành vi chi trả thực tế',
      [JuryBossId.RISK_STRATEGIST]: 'Đánh giá thấp rào cản triển khai thực tế',
    };

    const answerLower = (answer || '').toLowerCase();
    const isNoResponse =
      !answer ||
      answerLower.includes('không phản hồi') ||
      answerLower.includes('quá ngắn') ||
      answerLower.includes('bỏ qua') ||
      answerLower.includes('kết thúc đối chất');

    const isVerbose = verdict?.isVerbose || false;

    let weakness = '';
    let fallacy: string | undefined = undefined;

    if (isNoResponse) {
      weakness = 'Thí sinh không phản hồi hoặc né tránh câu hỏi chất vấn của Giám khảo.';
      fallacy = 'Né tránh chất vấn / Bỏ qua câu hỏi';
    } else if (isVerbose) {
      weakness = 'Thí sinh trả lời quá dài trong giới hạn 30s, chưa kịp hoàn thành kết luận trọng tâm.';
      fallacy = 'Chưa quản lý tốt thời gian (Quá dài trong 30s)';
    } else if (isGoodTurn) {
      weakness = 'Luận điểm bảo vệ tốt, có cơ sở lập luận và số liệu thuyết phục.';
      fallacy = undefined;
    } else {
      weakness =
        this.cleanReasonText(verdict?.reason) ||
        verdict?.prosecutorArgument ||
        'Luận điểm chưa đủ căn cứ thuyết phục.';
      fallacy = fallacyByBoss[bossId];
    }

    // Tạo câu trả lời mẫu hoặc đề xuất tìm kiếm bổ sung - CHỈ RƠI VÀO 2 TRƯỜNG HỢP NÀY
    const grounding = this.generateGroundingAndSampleAnswer(bossId, question, difficulty, doc);

    return {
      fallbackTopic: topicByBoss[bossId] || 'Đối chất chuyên môn',
      weakness,
      fallacy,
      proposal: grounding.slideActionProposal,
      slideTitle: grounding.recommendedSlideTitle,
      sampleDefenseArgument: grounding.sampleDefenseArgument,
      isDocxGrounded: grounding.isDocxGrounded,
    };
  }

  private extractStrengths(items: AppendixItem[]): string[] {
    const strengths: string[] = [];
    const goodItems = items.filter((it) => it.severity === 'GOOD');
    if (goodItems.length > 0) {
      goodItems.slice(0, 3).forEach((it) => {
        strengths.push(`Lượt ${it.turnIndex} (${it.topic}): Luận cứ có cơ sở dữ liệu thuyết phục, thái độ tiếp thu tốt (+${it.hpImpact} HP).`);
      });
    } else {
      strengths.push('Thí sinh kiên trì bảo vệ luận điểm xuyên suốt các đợt chất vấn của Hội đồng.');
    }
    return strengths;
  }

  private extractRisks(items: AppendixItem[]): string[] {
    const risks: string[] = [];
    const criticalItems = items.filter((it) => it.severity === 'CRITICAL' || it.severity === 'WARNING');
    if (criticalItems.length > 0) {
      criticalItems.slice(0, 3).forEach((it) => {
        const cleanW = this.cleanReasonText(it.weaknessIdentified);
        risks.push(`[${it.bossName}]: ${cleanW || it.weaknessIdentified}`);
      });
    } else {
      risks.push('Không có lỗ hổng nghiêm trọng nào đe dọa sự sống còn của dự án.');
    }
    return risks;
  }

  /**
   * Tạo các mục chẩn đoán mặc định phù hợp với cấp độ khó và tệp khách hàng từ tài liệu
   */
  private getDefaultDiagnosticItems(
    bossId: JuryBossId,
    difficulty: CombatDifficulty = CombatDifficulty.NORMAL,
    doc?: DocumentAnalysisResult
  ): AppendixItem[] {
    const targetCustomer =
      doc?.foundationFacts?.targetCustomerType || 'người dùng mục tiêu';

    if (difficulty === CombatDifficulty.EASY) {
      return [
        {
          turnIndex: 1,
          bossId: JuryBossId.FINANCE_DRAGON,
          bossName: 'GS. Vũ Hoàng',
          topic: 'Dự toán Ngân sách 6 Tháng Đầu',
          question: 'Chi phí duy trì hệ thống và khả năng sống sót trong 6 tháng đầu nếu chưa có doanh thu đột biến?',
          candidateAnswer: 'Nhóm dự định dùng số tiền tiết kiệm và tận dụng máy chủ miễn phí của nhà trường.',
          weaknessIdentified: 'Chưa có dự toán ngân sách chi tiết cho 6 tháng đầu, tiềm ẩn rủi ro thiếu hụt chi phí duy trì.',
          fallacyType: 'Kỳ vọng ngân sách quá lạc quan',
          slideActionProposal: `Bổ sung bảng dự toán ngân sách tối thiểu (chi phí máy chủ, vận hành hạt giống) bảo đảm dự án duy trì được 6 tháng với nguồn lực sinh viên hiện có.`,
          recommendedSlideTitle: 'Slide Phụ lục F1: Dự Toán Ngân Sách Tối Thiểu 6 Tháng Đầu',
          sampleDefenseArgument: `Trong file Word hiện chưa có dự toán chi phí vận hành chi tiết 6 tháng đầu. Đề xuất bạn: Liệt kê chi phí tối thiểu gồm máy chủ (Domain/Hosting), chi phí làm mẫu, công cụ AI, và tính số lượng ${targetCustomer} cần đạt để tự bù chi phí duy trì.`,
          isDocxGrounded: false,
          hpImpact: -15,
          score: { directness: 40, factualBacking: 35, intellectualHonesty: 50, overallScore: 42 },
          severity: 'CRITICAL',
        },
        {
          turnIndex: 2,
          bossId: JuryBossId.TECH_SENTINEL,
          bossName: 'TS. Lê Minh Trang',
          topic: 'Xử lý Ngoại lệ & Trải nghiệm Người dùng',
          question: 'Khi mạng chập chờn hoặc API bên ngoài bị lỗi, người dùng sẽ trải nghiệm như thế nào?',
          candidateAnswer: 'Hệ thống sẽ hiện thông báo lỗi và yêu cầu người dùng thử lại.',
          weaknessIdentified: 'Chưa có quy trình xử lý ngoại lệ thân thiện, có thể khiến người dùng bối rối khi gặp sự cố mạng.',
          fallacyType: 'Thiếu tư duy xử lý ngoại lệ cơ bản',
          slideActionProposal: 'Bổ sung lưu đồ xử lý lỗi ngoại lệ và lưu tạm thông tin người dùng cục bộ khi mất kết nối.',
          recommendedSlideTitle: 'Slide Phụ lục T2: Quy Trình Xử Lý Ngoại Lệ & Trải Nghiệm Offline',
          sampleDefenseArgument: 'Trong file Word hiện chưa nêu phương án xử lý sự cố mạng hoặc lỗi API bên ngoài. Đề xuất bạn: Bổ sung quy trình xử lý ngoại lệ với thông báo thân thiện và cơ chế lưu tạm dữ liệu trên thiết bị người dùng (LocalStorage/Cache) vào slide kỹ thuật.',
          isDocxGrounded: false,
          hpImpact: -10,
          score: { directness: 55, factualBacking: 50, intellectualHonesty: 60, overallScore: 55 },
          severity: 'WARNING',
        },
        {
          turnIndex: 3,
          bossId: JuryBossId.MARKET_SHARK,
          bossName: 'Shark Trần Nam',
          topic: 'Xác thực Nhu cầu Người dùng',
          question: 'Bằng chứng nào chứng minh người dùng thực sự muốn dùng sản phẩm thay vì chỉ trả lời ủng hộ trên phiếu khảo sát?',
          candidateAnswer: 'Nhóm đã phỏng vấn trực tiếp 15 người dùng tiềm năng, trong đó 12 người mong muốn dùng thử bản MVP ngay khi ra mắt.',
          weaknessIdentified: 'Luận điểm tốt, có phản hồi thực tế từ người dùng mục tiêu.',
          fallacyType: undefined,
          slideActionProposal: `Đưa các hình ảnh trải nghiệm và trích dẫn trực tiếp từ ${targetCustomer} dùng thử vào slide để tăng độ tin cậy trước Ban giám khảo.`,
          recommendedSlideTitle: 'Slide Phụ lục M1: Dữ Liệu Phỏng Vấn Sâu & Danh Sách Đăng Ký Trải Nghiệm',
          sampleDefenseArgument: `Thưa Ban giám khảo, theo kết quả phỏng vấn trực tiếp 15 ${targetCustomer}, có 12 người mong muốn dùng thử bản MVP ngay khi ra mắt và sẵn sàng đóng góp ý kiến hoàn thiện tính năng.`,
          isDocxGrounded: true,
          hpImpact: 5,
          score: { directness: 85, factualBacking: 80, intellectualHonesty: 90, overallScore: 85 },
          severity: 'GOOD',
        },
      ];
    }

    if (difficulty === CombatDifficulty.NORMAL) {
      return [
        {
          turnIndex: 1,
          bossId: JuryBossId.FINANCE_DRAGON,
          bossName: 'GS. Vũ Hoàng',
          topic: 'Dòng tiền & Chi phí vận hành',
          question: 'Chi phí duy trì hệ thống và khả năng sống sót trong 6 tháng đầu nếu chưa có doanh thu đột biến?',
          candidateAnswer: 'Nhóm dự định gọi vốn và dùng số tiền tài trợ của vườn ươm khởi nghiệp.',
          weaknessIdentified: 'Phụ thuộc vào nguồn tài trợ chưa cam kết, chưa có kịch bản sống sót (Survival Runway) tự lực.',
          fallacyType: 'Ảo tưởng dòng tiền ngoại sinh',
          slideActionProposal: 'Bổ sung bảng phân bổ chi phí tối thiểu theo tháng (Bootstrapping Burn Rate) bảo đảm dự án duy trì 6 tháng.',
          recommendedSlideTitle: 'Slide Phụ lục F1: Kế Hoạch Sinh Tồn Tự Lực (Bootstrapping Runway)',
          sampleDefenseArgument: `Trong file Word hiện chưa có bảng tính điểm hòa vốn cụ thể. Đề xuất bạn: Phân tách rõ chi phí cố định (máy chủ, nhân sự) và chi phí biến đổi trên mỗi đơn vị dịch vụ, tính toán sản lượng hòa vốn để bổ sung vào slide phụ lục.`,
          isDocxGrounded: false,
          hpImpact: -15,
          score: { directness: 40, factualBacking: 35, intellectualHonesty: 50, overallScore: 42 },
          severity: 'CRITICAL',
        },
        {
          turnIndex: 2,
          bossId: JuryBossId.TECH_SENTINEL,
          bossName: 'TS. Lê Minh Trang',
          topic: 'Độ trễ & Kiến trúc Fallback',
          question: 'Khi hệ thống mạng chập chờn hoặc API bên thứ ba mất kết nối, người dùng sẽ trải nghiệm như thế nào?',
          candidateAnswer: 'Hệ thống sẽ hiện thông báo lỗi và yêu cầu người dùng thử lại.',
          weaknessIdentified: 'Chưa có phương án xử lý Offline cục bộ, gây đứt gãy trải nghiệm người dùng.',
          fallacyType: 'Thiếu tư duy phòng thủ phần mềm (Defensive Design Gap)',
          slideActionProposal: 'Thiết kế cơ chế lưu trữ đệm tại thiết bị đầu cuối và tự động đồng bộ khi có kết nối trở lại.',
          recommendedSlideTitle: 'Slide Phụ lục T2: Sơ đồ Khối Cơ chế Dự phòng Offline & Tái kết nối',
          sampleDefenseArgument: 'Trong file Word hiện chưa có sơ đồ kiến trúc dự phòng. Đề xuất bạn: Vẽ sơ đồ khối thể hiện cơ chế Local Cache kết hợp kịch bản phục hồi khi mất kết nối Cloud.',
          isDocxGrounded: false,
          hpImpact: -10,
          score: { directness: 55, factualBacking: 50, intellectualHonesty: 60, overallScore: 55 },
          severity: 'WARNING',
        },
        {
          turnIndex: 3,
          bossId: JuryBossId.MARKET_SHARK,
          bossName: 'Shark Trần Nam',
          topic: 'Xác thực Nhu cầu Chi trả',
          question: 'Bằng chứng nào chứng minh người dùng thực sự trả tiền thay vì chỉ nói ủng hộ trên phiếu khảo sát?',
          candidateAnswer: `Nhóm đã thử nghiệm với 20 ${targetCustomer} ban đầu và có 6 người đồng ý trả phí danh nghĩa để tiếp tục sử dụng.`,
          weaknessIdentified: 'Luận điểm tốt, có số liệu thử nghiệm thu phí bước đầu.',
          fallacyType: undefined,
          slideActionProposal: 'Đưa số liệu chuyển đổi và phản hồi từ nhóm người dùng dùng thử có thu phí vào slide để tăng độ tin cậy trước Ban giám khảo.',
          recommendedSlideTitle: 'Slide Phụ lục M1: Dữ Liệu Thử Nghiệm Thu Phí Danh Nghĩa & Tỷ Lệ Chuyển Đổi',
          sampleDefenseArgument: `Thưa Ban giám khảo, theo kết quả triển khai thử nghiệm trên 20 ${targetCustomer}, nhóm đã ghi nhận 6 người chấp nhận trả phí danh nghĩa để tiếp tục sử dụng dịch vụ, chứng minh tính khả thi chuyển đổi thương mại.`,
          isDocxGrounded: true,
          hpImpact: 5,
          score: { directness: 85, factualBacking: 80, intellectualHonesty: 90, overallScore: 85 },
          severity: 'GOOD',
        },
      ];
    }

    // Mặc định HARDCORE
    return [
      {
        turnIndex: 1,
        bossId: JuryBossId.FINANCE_DRAGON,
        bossName: 'GS. Vũ Hoàng',
        topic: 'Dòng tiền & Chi phí vận hành',
        question: 'Chi phí duy trì hệ thống và khả năng sống sót trong 6 tháng đầu nếu chưa có doanh thu đột biến?',
        candidateAnswer: 'Nhóm dự định gọi vốn và dùng số tiền tài trợ của nhà trường.',
        weaknessIdentified: 'Phụ thuộc vào nguồn tài trợ chưa cam kết, chưa có kịch bản sống sót (Survival Runway) tự lực.',
        fallacyType: 'Ảo tưởng dòng tiền ngoại sinh',
        slideActionProposal: 'Bổ sung bảng phân bổ chi phí tối thiểu theo tháng (Bootstrapping Burn Rate) bảo đảm dự án duy trì 6 tháng.',
        recommendedSlideTitle: 'Slide Phụ lục F1: Kế hoạch Sinh tồn Tự lực (Bootstrapping Runway)',
        sampleDefenseArgument: 'Trong file Word hiện chưa có kịch bản tự lực. Đề xuất bạn: Bổ sung bảng phân bổ chi phí tối thiểu theo tháng (Bootstrapping Burn Rate) và mô hình Unit Economics khắt khe.',
        isDocxGrounded: false,
        hpImpact: -15,
        score: { directness: 40, factualBacking: 35, intellectualHonesty: 50, overallScore: 42 },
        severity: 'CRITICAL',
      },
      {
        turnIndex: 2,
        bossId: JuryBossId.TECH_SENTINEL,
        bossName: 'TS. Lê Minh Trang',
        topic: 'Độ trễ & Kiến trúc Fallback',
        question: 'Khi hệ thống mạng chập chờn hoặc API bên thứ ba mất kết nối, người dùng sẽ trải nghiệm như thế nào?',
        candidateAnswer: 'Hệ thống sẽ hiện thông báo lỗi và yêu cầu người dùng thử lại.',
        weaknessIdentified: 'Chưa có phương án xử lý Offline cục bộ, gây đứt gãy trải nghiệm người dùng nghiêm trọng.',
        fallacyType: 'Thiếu tư duy phòng thủ phần mềm (Defensive Design Gap)',
        slideActionProposal: 'Thiết kế cơ chế lưu trữ đệm tại thiết bị đầu cuối và tự động đồng bộ khi có kết nối trở lại.',
        recommendedSlideTitle: 'Slide Phụ lục T2: Sơ đồ Khối Cơ chế Dự phòng Offline & Tái kết nối',
        sampleDefenseArgument: 'Trong file Word hiện chưa có cơ chế phòng thủ phân tán. Đề xuất bạn: Thiết kế cơ chế lưu trữ đệm tại thiết bị đầu cuối và tự động đồng bộ khi khôi phục kết nối.',
        isDocxGrounded: false,
        hpImpact: -10,
        score: { directness: 55, factualBacking: 50, intellectualHonesty: 60, overallScore: 55 },
        severity: 'WARNING',
      },
      {
        turnIndex: 3,
        bossId: JuryBossId.MARKET_SHARK,
        bossName: 'Shark Trần Nam',
        topic: 'Xác thực Nhu cầu Chi trả',
        question: 'Bằng chứng nào chứng minh người dùng thực sự trả tiền thay vì chỉ nói ủng hộ trên phiếu khảo sát?',
        candidateAnswer: 'Nhóm đã có 15 thư quan tâm (LOI) và 3 đơn vị đồng ý triển khai thử nghiệm có thu phí danh nghĩa.',
        weaknessIdentified: 'Luận điểm tốt, có bằng chứng thực tế bước đầu.',
        fallacyType: undefined,
        slideActionProposal: 'Đưa logo và trích dẫn trực tiếp từ 3 đơn vị dùng thử vào slide để tăng độ tin cậy trước Ban giám khảo.',
        recommendedSlideTitle: 'Slide Phụ lục M1: Danh sách Đơn vị Hạt giống & Bằng chứng Thu phí Thử nghiệm',
        sampleDefenseArgument: 'Thưa Ban giám khảo, nhóm đã có 15 thư quan tâm (LOI) và 3 đơn vị đồng ý triển khai thử nghiệm có thu phí danh nghĩa, chứng minh nhu cầu thực tế từ thị trường.',
        isDocxGrounded: true,
        hpImpact: 5,
        score: { directness: 85, factualBacking: 80, intellectualHonesty: 90, overallScore: 85 },
        severity: 'GOOD',
      },
    ];
  }
}


