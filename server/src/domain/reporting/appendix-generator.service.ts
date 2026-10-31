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
        juryIntent: this.getJuryIntent(bossId, verdict?.topic || diagnosis.fallbackTopic),
        slideStructureBullets: this.getSlideStructureBullets(bossId, diagnosis.slideTitle),
        winningResponse: diagnosis.sampleDefenseArgument,
        actionSteps: this.getActionSteps(bossId, diagnosis.isDocxGrounded),
      });
    }

    // Nếu không có lượt nào trong transcript (ví dụ vào thẳng bước 5), tạo các mục chẩn đoán mặc định phù hợp độ khó
    if (items.length === 0) {
      const defaultItems = this.getDefaultDiagnosticItems(session.activeBossId, difficulty, doc);
      items.push(
        ...defaultItems.map((it) => ({
          ...it,
          juryIntent: this.getJuryIntent(it.bossId, it.topic),
          slideStructureBullets: this.getSlideStructureBullets(it.bossId, it.recommendedSlideTitle),
          winningResponse: it.sampleDefenseArgument,
          actionSteps: this.getActionSteps(it.bossId, it.isDocxGrounded ?? false),
        }))
      );
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
   * Trích xuất ý đồ thẩm định cốt lõi của Giám khảo (Jury Intent)
   */
  public getJuryIntent(bossId: JuryBossId, topic?: string): string {
    switch (bossId) {
      case JuryBossId.FINANCE_DRAGON:
        return 'Thẩm định tính tự chủ tài chính, cơ chế bù đắp chi phí vận hành (OpEx) và điểm hòa vốn thực tế trước khi cạn kiệt ngân sách.';
      case JuryBossId.TECH_SENTINEL:
        return 'Thẩm định tính khả thi kỹ thuật, độ trễ và cơ chế dự phòng ngoại lệ khi mạng sập hoặc API bên thứ ba mất kết nối.';
      case JuryBossId.MARKET_SHARK:
        return 'Thẩm định bằng chứng nhu cầu thực tế và mức độ sẵn sàng chi trả của khách hàng mục tiêu, bóc trần khảo sát thái độ ảo.';
      case JuryBossId.RISK_STRATEGIST:
        return 'Thẩm định rào cản phòng thủ (Moat), rủi ro pháp lý/sở hữu trí tuệ và tính kỷ luật trong lộ trình triển khai của đội ngũ.';
      default:
        return 'Thẩm định tính thực tế, căn cứ số liệu và tính bền vững của mô hình đề xuất.';
    }
  }

  /**
   * Tạo bộ 3 khối cấu trúc Slide phụ lục bắt buộc (Slide Skeleton)
   */
  public getSlideStructureBullets(bossId: JuryBossId, slideTitle?: string): string[] {
    switch (bossId) {
      case JuryBossId.FINANCE_DRAGON:
        return [
          'Khối 1: Bảng phân bổ chi phí cố định (API + Máy chủ + Vận hành) theo từng tháng.',
          'Khối 2: Biểu đồ điểm hòa vốn (Break-even): Mốc số lượng khách hàng trả phí cần đạt.',
          'Khối 3: Nguồn vốn dự phòng & Kế hoạch duy trì tối thiểu 6 tháng khi chưa có lãi.',
        ];
      case JuryBossId.TECH_SENTINEL:
        return [
          'Khối 1: Sơ đồ luồng dữ liệu 2 tầng: Xử lý Cloud Stream & Bộ đệm Offline cục bộ.',
          'Khối 2: Thông số thực nghiệm: Độ trễ P95 (<220ms), tải RAM và giới hạn chịu lỗi.',
          'Khối 3: Ma trận xử lý ngoại lệ: Trải nghiệm thông báo thân thiện khi mất kết nối.',
        ];
      case JuryBossId.MARKET_SHARK:
        return [
          'Khối 1: Dữ liệu phỏng vấn sâu 10-15 khách hàng & Trích dẫn trực tiếp về nỗi đau.',
          'Khối 2: Bằng chứng cam kết chi trả thực tế (Thư quan tâm LOI / Đơn đặt trước pilot).',
          'Khối 3: Phân tích chi phí tìm khách (CAC) và kênh tiếp cận 100 người dùng đầu tiên.',
        ];
      case JuryBossId.RISK_STRATEGIST:
        return [
          'Khối 1: Ma trận so sánh tính năng và rào cản phòng thủ (Moat) trước đối thủ lớn.',
          'Khối 2: Kế hoạch pháp lý, bản quyền sở hữu trí tuệ và bảo vệ dữ liệu người dùng.',
          'Khối 3: Lộ trình 6 tháng với cột mốc định lượng (KPI) và phân công trách nhiệm.',
        ];
      default:
        return [
          'Khối 1: Luận cứ bổ sung số liệu minh chứng từ tài liệu đề án.',
          'Khối 2: Sơ đồ hoặc biểu đồ trực quan hóa giải pháp.',
          'Khối 3: Lộ trình và chỉ số đo lường hiệu quả cụ thể.',
        ];
    }
  }

  /**
   * Tạo 3 bước hành động cụ thể cần làm tiếp theo (48h Action Steps)
   */
  public getActionSteps(bossId: JuryBossId, isDocxGrounded: boolean): string[] {
    switch (bossId) {
      case JuryBossId.FINANCE_DRAGON:
        return [
          'Bước 1 (Tính chi phí OpEx): Lập bảng Excel dự toán chi phí cố định tối thiểu (API, Server, Domain, Vận hành) theo từng tháng trong 6 tháng đầu.',
          'Bước 2 (Tính điểm hòa vốn): Tính toán số lượng khách hàng trả phí tối thiểu cần đạt để doanh thu tự bù đắp toàn bộ chi phí vận hành hàng tháng.',
          'Bước 3 (Đóng gói Slide F1): Lập bảng chi phí vs doanh thu và vẽ biểu đồ điểm hòa vốn đưa vào Slide Phụ lục F1 sẵn sàng phản biện.',
        ];
      case JuryBossId.TECH_SENTINEL:
        return [
          'Bước 1 (Thiết kế luồng dự phòng): Vẽ sơ đồ khối kiến trúc 2 tầng (Primary Cloud Flow & Local Fallback Cache) xử lý tình huống mất kết nối mạng.',
          'Bước 2 (Đo lường thông số): Chạy thử nghiệm đo lường độ trễ phản hồi (P95 < 220ms), tải RAM và tỷ lệ thành công của API để có số liệu thực nghiệm.',
          'Bước 3 (Đóng gói Slide T2): Đưa sơ đồ kiến trúc dự phòng và bảng kết quả đo lường độ trễ thực tế vào Slide Phụ lục T2.',
        ];
      case JuryBossId.MARKET_SHARK:
        return [
          'Bước 1 (Xác thực thực tế): Phỏng vấn sâu 10 - 15 khách hàng mục tiêu để ghi nhận nỗi đau thực tế và mức độ sẵn sàng chi trả thay vì khảo sát lý thuyết.',
          'Bước 2 (Lấy cam kết thử nghiệm): Ký kết hoặc xin tối thiểu 3 Thư xác nhận quan tâm (LOI / Pilot Agreement) có điều khoản trả phí thử nghiệm danh nghĩa.',
          'Bước 3 (Đóng gói Slide M1): Đưa hình ảnh phỏng vấn, logo đối tác pilot và tỷ lệ chuyển đổi thực tế vào Slide Phụ lục M1.',
        ];
      case JuryBossId.RISK_STRATEGIST:
        return [
          'Bước 1 (Lập ma trận cạnh tranh): Tạo bảng so sánh 3 cột giữa dự án của bạn và 2 đối thủ lớn nhất, chọn ra đúng 2 tính năng vượt trội không thể sao chép.',
          'Bước 2 (Khóa pháp lý & Lộ trình): Xác lập kế hoạch đăng ký sở hữu trí tuệ/bản quyền và phân rã 3 mốc KPI định lượng cho đội ngũ trong 6 tháng tới.',
          'Bước 3 (Đóng gói Slide R3): Đưa bảng ma trận tính năng (đánh dấu tick xanh cho lợi thế cốt lõi) và lộ trình phát triển vào Slide Phụ lục R3.',
        ];
      default:
        return [
          'Bước 1 (Bổ sung số liệu): Thu thập dữ liệu thực tế và tính toán chỉ số định lượng còn thiếu.',
          'Bước 2 (Kiểm chứng luận điểm): Đối chiếu số liệu với mục tiêu của đề án để bảo đảm tính nhất quán.',
          'Bước 3 (Cập nhật Slide Phụ lục): Vẽ sơ đồ/bảng số liệu trực quan đưa vào slide phụ lục tương ứng.',
        ];
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
      let proposalText = '';

      if (bossId === JuryBossId.FINANCE_DRAGON) {
        slideTitle = 'Slide Phụ lục F1: Bảng Dữ Liệu Chi Phí & Điểm Hòa Vốn (Từ Đề Án)';
        proposalText = `Bổ sung bảng phân bổ chi phí cố định (API, Server, Vận hành) 6 tháng đầu và điểm hòa vốn dựa trên số liệu tại mục "${evidence.sectionTitle}" vào Slide Phụ lục F1.`;
        sampleText = `Thưa Thầy/Cô, trong bản thuyết minh tại mục "${evidence.sectionTitle}", nhóm đã nêu rõ: "${compactEvidence}". Về cơ chế tài chính, nhóm tối ưu hóa chi phí vận hành ở mức tối thiểu để bảo toàn dòng tiền qua 6 tháng đầu. Khi đạt mốc người dùng thử nghiệm ổn định, nhóm sẽ kích hoạt gói dịch vụ nâng cao để tự chủ dòng tiền mà không phụ thuộc nguồn tài trợ bên ngoài.`;
      } else if (bossId === JuryBossId.MARKET_SHARK) {
        slideTitle = 'Slide Phụ lục M1: Dữ Liệu Khảo Sát & Xác Thực Nhu Cầu Người Dùng (Từ Đề Án)';
        proposalText = `Đưa số liệu khảo sát và trích dẫn trực tiếp từ ${targetCustomer} tại mục "${evidence.sectionTitle}" vào Slide Phụ lục M1 để chứng minh nhu cầu thực tế.`;
        sampleText = `Thưa Thầy/Cô, về nhu cầu của ${targetCustomer}, tại mục "${evidence.sectionTitle}" nhóm đã chỉ ra: "${compactEvidence}". Giải pháp của nhóm giải quyết trực diện điểm nghẽn thực tế so với cách làm thủ công cũ. Nhóm bắt đầu từ nhóm 20 khách hàng hạt giống thân thiết nhất để hoàn thiện trải nghiệm và xác thực hành vi chi trả trước khi mở rộng.`;
      } else if (bossId === JuryBossId.TECH_SENTINEL) {
        slideTitle = 'Slide Phụ lục T2: Sơ Đồ Kiến Trúc & Cơ Chế Vận Hành Kỹ Thuật (Từ Đề Án)';
        proposalText = `Vẽ sơ đồ luồng dữ liệu 2 tầng và cơ chế dự phòng Offline dựa trên thiết kế tại mục "${evidence.sectionTitle}" vào Slide Phụ lục T2.`;
        sampleText = `Thưa Thầy/Cô, về mặt kỹ thuật, tại mục "${evidence.sectionTitle}" nhóm đã thiết kế: "${compactEvidence}". Hệ thống kết hợp cơ chế xử lý cục bộ và đồng bộ nền (Background Sync) để khi mạng chập chờn, trải nghiệm người dùng vẫn thông suốt dưới 5ms và tự động đẩy dữ liệu lên máy chủ ngay khi có kết nối trở lại.`;
      } else {
        slideTitle = 'Slide Phụ lục R3: Ma Trận Cạnh Tranh & Kế Hoạch Triển Khai (Từ Đề Án)';
        proposalText = `Lập bảng ma trận so sánh 3 tiêu chí vượt trội và lộ trình phân công nhiệm vụ dựa trên mục "${evidence.sectionTitle}" vào Slide Phụ lục R3.`;
        sampleText = `Thưa Thầy/Cô, về định hướng cạnh tranh, tại mục "${evidence.sectionTitle}" nhóm đã nêu: "${compactEvidence}". Điểm khác biệt cốt lõi là giải pháp tập trung sâu vào bài toán bản địa và sự linh hoạt của đội ngũ. Nhóm đã phân công rõ ràng từng mốc KPI trong lộ trình 6 tháng để bảo đảm tốc độ triển khai vượt trội hơn các giải pháp cồng kềnh trên thị trường.`;
      }

      return {
        isDocxGrounded: true,
        slideActionProposal: proposalText,
        recommendedSlideTitle: slideTitle,
        sampleDefenseArgument: sampleText,
      };
    }

    // =========================================================================
    // TRƯỜNG HỢP 2: TÀI LIỆU WORD THỰC SỰ CHƯA CÓ NỘI DUNG VỀ ĐỀ TÀI NÀY
    // =========================================================================
    let missingAnswer = '';
    let missingSlideTitle = '';
    let missingProposal = '';

    if (bossId === JuryBossId.FINANCE_DRAGON) {
      missingSlideTitle = 'Slide Phụ lục F1: Dự Toán Ngân Sách Vận Hành & Điểm Hòa Vốn (Bổ Sung)';
      missingProposal = `Lập bảng Excel dự toán chi phí cố định (API, Server, Domain) 6 tháng đầu và tính mốc người dùng hòa vốn đưa vào Slide Phụ lục F1.`;
      missingAnswer = `Thưa Thầy/Cô, hiện đề án đang ở giai đoạn thử nghiệm nên nhóm đang tạm ước tính chi phí tối thiểu theo quy mô sinh viên (dưới 10 triệu/tháng). Nhóm xin tiếp thu góp ý của Thầy/Cô và đã chuẩn bị bảng dự toán chi tiết cùng điểm hòa vốn tại 50 khách hàng trả phí trong Slide Phụ lục F1 để Hội đồng thẩm định.`;
    } else if (bossId === JuryBossId.MARKET_SHARK) {
      missingSlideTitle = 'Slide Phụ lục M1: Dữ Liệu Khảo Sát & Xác Thực Chi Trả Người Dùng (Bổ Sung)';
      missingProposal = `Phỏng vấn sâu 10-15 khách hàng mục tiêu và thu thập tối thiểu 3 Thư quan tâm (LOI) có cam kết thử nghiệm đưa vào Slide Phụ lục M1.`;
      missingAnswer = `Thưa Thầy/Cô, thay vì chỉ dừng ở phiếu khảo sát, nhóm đã tiến hành phỏng vấn sâu 15 khách hàng đại diện và ghi nhận 12 người sẵn sàng trải nghiệm trả phí pilot. Nhóm xin tiếp thu góp ý của Thầy/Cô và đã tổng hợp phản hồi thực tế cùng 3 thư xác nhận quan tâm vào Slide Phụ lục M1.`;
    } else if (bossId === JuryBossId.TECH_SENTINEL) {
      missingSlideTitle = 'Slide Phụ lục T2: Quy Trình Xử Lý Ngoại Lệ & Dự Phòng Kỹ Thuật (Bổ Sung)';
      missingProposal = `Thiết kế sơ đồ kiến trúc dự phòng ngoại lệ (Local Cache Fallback) và bảng đo lường độ trễ thực nghiệm đưa vào Slide Phụ lục T2.`;
      missingAnswer = `Thưa Thầy/Cô, giải pháp hiện tại đã tích hợp cơ chế lưu tạm dữ liệu tại chỗ (Local Cache) để bảo đảm khi mạng gián đoạn, người dùng vẫn thao tác bình thường. Nhóm xin tiếp thu và đã chuẩn bị sơ đồ xử lý ngoại lệ chi tiết tại Slide Phụ lục T2 để trình bày cùng Thầy/Cô.`;
    } else {
      missingSlideTitle = 'Slide Phụ lục R3: Ma Trận Khác Biệt & Lộ Trình Triển Khai (Bổ Sung)';
      missingProposal = `Lập ma trận so sánh 3 cột với 2 đối thủ lớn nhất và vạch lộ trình 3 mốc KPI định lượng 6 tháng tới đưa vào Slide Phụ lục R3.`;
      missingAnswer = `Thưa Thầy/Cô, điểm khác biệt cốt lõi của giải pháp nằm ở khả năng tối ưu hóa trải nghiệm bản địa và chi phí tiếp cận rẻ hơn 60% so với đối thủ ngoại. Nhóm xin tiếp thu và đã lượng hóa ma trận so sánh 3 tính năng vượt trội cùng lộ trình 6 tháng tại Slide Phụ lục R3 để Thầy/Cô thẩm định.`;
    }

    return {
      isDocxGrounded: false,
      slideActionProposal: missingProposal,
      recommendedSlideTitle: missingSlideTitle,
      sampleDefenseArgument: missingAnswer,
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
          sampleDefenseArgument: `Thưa Thầy/Cô, trong 6 tháng đầu chưa có doanh thu đột biến, nhóm áp dụng chiến lược tự thân (Bootstrapping) với chi phí máy chủ và vận hành tối thiểu 5 triệu/tháng. Đội ngũ đã chuẩn bị quỹ dự phòng tự thân 30 triệu, bảo đảm hệ thống duy trì liên tục 6 tháng mà không chịu áp lực cạn kiệt ngân sách.`,
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
          sampleDefenseArgument: 'Thưa Thầy/Cô, khi mạng chập chờn hoặc API bên ngoài bị lỗi, hệ thống sẽ kích hoạt cơ chế lưu tạm dữ liệu cục bộ (Local Cache) trên thiết bị để người dùng tiếp tục thao tác bình thường, sau đó âm thầm tự động đồng bộ khi có kết nối trở lại mà không gián đoạn trải nghiệm.',
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
          sampleDefenseArgument: `Thưa Thầy/Cô, trong 6 tháng đầu chưa có doanh thu đột biến, dự án áp dụng chiến lược sinh tồn tự lực (Bootstrapping Runway) với chi phí vận hành tối thiểu 5 triệu/tháng cho API và máy chủ. Đội ngũ đã trích lập quỹ dự phòng 30 triệu bảo đảm duy trì 6 tháng độc lập, không phụ thuộc vào các nguồn tài trợ chưa cam kết bên ngoài.`,
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
          sampleDefenseArgument: 'Thưa Thầy/Cô, khi mạng chập chờn hoặc API bên thứ ba mất kết nối, hệ thống kích hoạt cơ chế 2 tầng: bộ đệm Local Cache tại thiết bị đầu cuối xử lý phản hồi tức thì dưới 5ms, sau đó âm thầm tự động đồng bộ dữ liệu ngay khi mạng khôi phục, giúp người dùng không bao giờ gặp lỗi đứt gãy màn hình.',
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
        sampleDefenseArgument: 'Thưa Thầy/Cô, trong kịch bản xấu nhất 6 tháng đầu chưa phát sinh doanh thu, nhóm kích hoạt kịch bản sinh tồn tự lực (Bootstrapping Runway) với chi phí cố định tối thiểu 4.5 triệu/tháng. Đội ngũ tự túc quỹ dự phòng 30 triệu, đủ sức cầm cự an toàn 6 tháng để hoàn thiện sản phẩm và chinh phục 50 khách hàng trả phí đầu tiên.',
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
        sampleDefenseArgument: 'Thưa Thầy/Cô, hệ thống được thiết kế theo nguyên lý phòng thủ phân tán: khi mạng gián đoạn hoặc API đối tác gặp sự cố, ứng dụng tự động chuyển sang chế độ Offline-first qua bộ nhớ đệm cục bộ, bảo đảm mọi thao tác của người dùng vẫn thông suốt và tự phục hồi đồng bộ ngay khi tái kết nối.',
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


