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
      const hpDelta = verdict ? verdict.hpDelta : 0;

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
  } {
    const isGoodTurn = (verdict?.hpDelta ?? 0) >= 0;
    const targetCustomer =
      doc?.foundationFacts?.targetCustomerType || 'người dùng mục tiêu';

    // 1. Nếu phản biện tốt (không bị trừ máu)
    if (isGoodTurn) {
      return {
        fallbackTopic: 'Bảo vệ Luận điểm Thành công',
        weakness: 'Luận điểm bảo vệ tốt, có cơ sở lập luận và số liệu thuyết phục.',
        fallacy: undefined,
        proposal:
          difficulty === CombatDifficulty.EASY
            ? `Bổ sung thêm hình ảnh trải nghiệm và trích dẫn trực tiếp từ ${targetCustomer} vào slide để minh chứng rõ nét hơn trước Hội đồng.`
            : difficulty === CombatDifficulty.NORMAL
            ? `Đưa số liệu kiểm chứng và trích dẫn phản hồi thực tế từ đợt thử nghiệm vào slide để tiếp tục củng cố độ tin cậy.`
            : `Đưa các chỉ số giữ chân và cam kết từ các khách hàng/đối tác tiên phong vào slide để gia tăng sức nặng trước Nhà đầu tư.`,
        slideTitle:
          difficulty === CombatDifficulty.EASY
            ? 'Slide Phụ lục: Minh Chứng Trải Nghiệm Thực Tế Của Người Dùng'
            : 'Slide Phụ lục: Dữ Liệu Kiểm Chứng & Đánh Giá Người Dùng',
      };
    }

    // 2. Nếu bị trừ máu - Chẩn đoán theo từng Boss và Cấp độ khó (Easy, Normal, Hardcore)
    if (bossId === JuryBossId.FINANCE_DRAGON) {
      if (difficulty === CombatDifficulty.EASY) {
        return {
          fallbackTopic: 'Dự toán Ngân sách & Điểm Thu phí Ban đầu',
          weakness:
            verdict?.prosecutorArgument ||
            'Kế hoạch tài chính chưa dự trù đủ chi phí duy trì cơ bản cho 6 tháng đầu.',
          fallacy: 'Kỳ vọng ngân sách quá lạc quan',
          proposal:
            `Bổ sung bảng dự toán ngân sách tối thiểu (chi phí máy chủ, công cụ phát triển, vận hành hạt giống) cho 6 tháng đầu; xác định số lượng ${targetCustomer} sử dụng để bắt đầu bù đắp chi phí duy trì cơ bản.`,
          slideTitle: 'Slide Phụ lục F1: Bảng Dự Toán Ngân Sách Tối Thiểu 6 Tháng & Điểm Bắt Đầu Thu Phí',
        };
      } else if (difficulty === CombatDifficulty.NORMAL) {
        return {
          fallbackTopic: 'Tài chính & Unit Economics',
          weakness:
            verdict?.prosecutorArgument ||
            'Chưa chứng minh được điểm hòa vốn thực tế và khả năng bù đắp chi phí vận hành.',
          fallacy: 'Ngụy biện kỳ vọng doanh thu tuyến tính',
          proposal:
            'Bổ sung bảng phân kỳ dòng tiền 6 tháng đầu; tách bạch rõ chi phí cố định (máy chủ, vận hành) và chi phí biến đổi trên mỗi đơn vị dịch vụ; xác định số lượng người dùng cần đạt để hòa vốn.',
          slideTitle: 'Slide Phụ lục F1: Bảng Tính Điểm Hòa Vốn & Dòng Tiền 6 Tháng',
        };
      } else {
        return {
          fallbackTopic: 'Dòng tiền & Kế hoạch Sinh tồn Tự lực',
          weakness:
            verdict?.prosecutorArgument ||
            'Phụ thuộc vào nguồn tài trợ chưa cam kết, chưa có kịch bản sống sót (Survival Runway) tự lực.',
          fallacy: 'Ảo tưởng dòng tiền ngoại sinh & thiếu kiểm soát Burn Rate',
          proposal:
            'Bổ sung bảng phân bổ chi phí tối thiểu theo tháng (Bootstrapping Burn Rate) và mô hình Unit Economics khắt khe (CAC, LTV, Payback Period) bảo đảm dự án duy trì 6-12 tháng mà không phụ thuộc gọi vốn.',
          slideTitle: 'Slide Phụ lục F1: Kế Hoạch Sinh Tồn Tự Lực (Bootstrapping Runway)',
        };
      }
    } else if (bossId === JuryBossId.TECH_SENTINEL) {
      if (difficulty === CombatDifficulty.EASY) {
        return {
          fallbackTopic: 'Xử lý Ngoại lệ & Trải nghiệm Người dùng',
          weakness:
            verdict?.prosecutorArgument ||
            'Chưa có kịch bản xử lý ngoại lệ thân thiện khi mạng chập chờn hoặc API bên ngoài ngắt kết nối.',
          fallacy: 'Thiếu tư duy xử lý ngoại lệ cơ bản',
          proposal:
            'Bổ sung lưu đồ xử lý ngoại lệ: hiển thị thông báo hướng dẫn người dùng thân thiện khi mất kết nối mạng và lưu tạm dữ liệu trên trình duyệt/thiết bị để tránh mất dữ liệu người dùng.',
          slideTitle: 'Slide Phụ lục T2: Quy Trình Xử Lý Ngoại Lệ & Trải Nghiệm Ngoại Tuyến (Offline)',
        };
      } else if (difficulty === CombatDifficulty.NORMAL) {
        return {
          fallbackTopic: 'Kiến trúc Kỹ thuật & Dự phòng',
          weakness:
            verdict?.prosecutorArgument ||
            'Thiếu phương án fallback tại chỗ khi API bên thứ ba gặp sự cố hoặc gián đoạn mạng.',
          fallacy: 'Ảo tưởng độ sẵn sàng tuyệt đối (100% Uptime Assumption)',
          proposal:
            'Bổ sung sơ đồ khối kiến trúc dự phòng: áp dụng cơ chế Cache cục bộ kết hợp bộ đệm hàng đợi (Queue) để giảm tải và bảo vệ trải nghiệm người dùng khi mất kết nối Cloud.',
          slideTitle: 'Slide Phụ lục T2: Kiến Trúc Dự Phòng & Cơ Chế Giảm Tải Độ Trễ',
        };
      } else {
        return {
          fallbackTopic: 'Kiến trúc Dự phòng Đa tầng & Chịu tải',
          weakness:
            verdict?.prosecutorArgument ||
            'Chưa có phương án xử lý Offline cục bộ, gây đứt gãy trải nghiệm người dùng nghiêm trọng.',
          fallacy: 'Thiếu tư duy phòng thủ phần mềm (Defensive Design Gap)',
          proposal:
            'Thiết kế cơ chế lưu trữ đệm tại thiết bị đầu cuối kết hợp Circuit Breaker tự ngắt và cơ chế tự động đồng bộ khi khôi phục kết nối, bảo đảm SLA 99.9% khi mở rộng quy mô.',
          slideTitle: 'Slide Phụ lục T2: Sơ Đồ Khối Cơ Chế Dự Phòng Offline & Tái Kết Nối Đa Tầng',
        };
      }
    } else if (bossId === JuryBossId.MARKET_SHARK) {
      if (difficulty === CombatDifficulty.EASY) {
        return {
          fallbackTopic: 'Xác thực Nhu cầu & Phỏng vấn Người dùng',
          weakness:
            verdict?.prosecutorArgument ||
            `Khảo sát ý kiến chưa thể hiện được cam kết chi trả hoặc nhu cầu cấp bách thực tế của ${targetCustomer}.`,
          fallacy: 'Nhầm lẫn giữa khảo sát ý kiến và hành vi chi trả thực tế',
          proposal:
            `Bổ sung kết quả phỏng vấn sâu 10-15 ${targetCustomer} khi trải nghiệm bản mẫu thử nghiệm; đưa vào trích dẫn trực tiếp và danh sách đăng ký chờ (Waitlist) để chứng minh nhu cầu thực tế thay vì chỉ dùng biểu đồ khảo sát lý thuyết.`,
          slideTitle: 'Slide Phụ lục M1: Phỏng Vấn Sâu Người Dùng & Dữ Liệu Dùng Thử',
        };
      } else if (difficulty === CombatDifficulty.NORMAL) {
        return {
          fallbackTopic: 'Khách hàng & Đo lường Mức sẵn sàng Chi trả',
          weakness:
            verdict?.prosecutorArgument ||
            'Số liệu khảo sát ý kiến chưa thể hiện được mức độ sẵn sàng chi trả (Willingness to Pay) cụ thể.',
          fallacy: 'Ngụy biện nhầm lẫn giữa "thích sản phẩm" và "sẵn sàng chi tiền"',
          proposal:
            `Bổ sung khảo sát đo lường mức độ sẵn sàng chi trả trên nhóm 20-30 người dùng mục tiêu (${targetCustomer}), kết hợp kết quả thử nghiệm pilot có thu phí danh nghĩa để chứng minh nhu cầu chuyển đổi.`,
          slideTitle: 'Slide Phụ lục M1: Đo Lường Mức Độ Sẵn Sàng Chi Trả & Dữ Liệu Dùng Thử',
        };
      } else {
        return {
          fallbackTopic: 'Khách hàng & Cam kết Trả phí Hạt giống',
          weakness:
            verdict?.prosecutorArgument ||
            'Chưa có minh chứng đơn đặt trước ràng buộc pháp lý hoặc thỏa thuận thương mại đã ký kết.',
          fallacy: 'Ảo tưởng chuyển đổi thương mại không có bằng chứng cam kết pháp lý',
          proposal:
            'Đưa vào minh chứng đơn đặt trước (Letter of Intent / Pre-orders) từ 5-10 đối tác thân thiết hoặc hợp đồng dùng thử có cam kết thanh toán thay vì chỉ dùng biểu đồ khảo sát lý thuyết.',
          slideTitle: 'Slide Phụ lục M1: Bằng Chứng Nhu Cầu & Cam Kết Trả Phí Hạt Giống (LOI / Pre-orders)',
        };
      }
    } else {
      if (difficulty === CombatDifficulty.EASY) {
        return {
          fallbackTopic: 'Lợi thế Khác biệt & Cam kết Đội ngũ',
          weakness:
            verdict?.prosecutorArgument ||
            'Chưa làm rõ 1-2 điểm khác biệt nổi trội nhất và cam kết thời gian vận hành của các thành viên.',
          fallacy: 'Đánh giá thấp thách thức triển khai thực tế',
          proposal:
            `Bổ sung bảng phân tích 1-2 điểm khác biệt cốt lõi giải quyết đúng nỗi đau của ${targetCustomer} so với các giải pháp hiện tại, kèm phân công trách nhiệm và mốc thời gian rõ ràng của các thành viên trong nhóm.`,
          slideTitle: 'Slide Phụ lục R3: Ma Trận Khác Biệt Cốt Lõi & Cam Kết Thực Hiện',
        };
      } else if (difficulty === CombatDifficulty.NORMAL) {
        return {
          fallbackTopic: 'Chiến lược Cạnh tranh & Rào cản Chuyển đổi',
          weakness:
            verdict?.prosecutorArgument ||
            'Chưa làm rõ rào cản chuyển đổi (Switching Cost) khi đối thủ sao chép tính năng.',
          fallacy: 'Ngụy biện lợi thế người đi đầu (First-mover Fallacy)',
          proposal:
            'Làm nổi bật lợi thế tích lũy dữ liệu người dùng, tính năng đặc thù bản địa và rào cản chi phí chuyển đổi khiến khách hàng khó từ bỏ giải pháp của nhóm.',
          slideTitle: 'Slide Phụ lục R3: Phân Tích Lợi Thế Cạnh Tranh & Rào Cản Giữ Chân',
        };
      } else {
        return {
          fallbackTopic: 'Chiến lược Phòng thủ Độc quyền & Pháp lý',
          weakness:
            verdict?.prosecutorArgument ||
            'Chưa làm rõ rào cản bảo vệ độc quyền (IP/Moat) khi các ông lớn công nghệ (Big Tech) tham gia thị trường.',
          fallacy: 'Ảo tưởng lợi thế cạnh tranh bền vững không có rào cản bảo hộ',
          proposal:
            'Làm nổi bật thỏa thuận độc quyền liên kết dữ liệu bản địa, đăng ký sở hữu trí tuệ hoặc chuẩn tích hợp sâu vào quy trình nghiệp vụ khách hàng hiện hữu để phòng thủ trước Big Tech.',
          slideTitle: 'Slide Phụ lục R3: Ma Trận Phòng Thủ Độc Quyền & Rào Cản Chuyển Đổi Cao',
        };
      }
    }
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
        hpImpact: 5,
        score: { directness: 85, factualBacking: 80, intellectualHonesty: 90, overallScore: 85 },
        severity: 'GOOD',
      },
    ];
  }
}

