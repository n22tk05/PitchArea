import { Injectable, Logger } from '@nestjs/common';
import {
  DocumentSection,
  JuryBossId,
  BOSS_TO_SECTION_MAP,
} from '@pitcharena/shared';

export interface RAGMatchResult {
  hasFactualSupport: boolean;
  matchedSections: string[];
  supportedNumbers: string[];
  inDubioProReoApplied: boolean; // Được cứu nhờ nguyên tắc suy đoán vô tội tìm thấy ở section khác
  relevanceScore: number;        // 0 - 100
  evidenceSnippets: string[];
}

@Injectable()
export class RAGEngineService {
  private readonly logger = new Logger(RAGEngineService.name);

  /**
   * Kiểm chứng luận điểm của thí sinh với 4 lớp In-Memory Bulletproof RAG
   */
  public verifyDefense(
    candidateSpeech: string,
    bossId: JuryBossId,
    sections: DocumentSection[]
  ): RAGMatchResult {
    if (!sections || sections.length === 0 || !candidateSpeech) {
      return {
        hasFactualSupport: false,
        matchedSections: [],
        supportedNumbers: [],
        inDubioProReoApplied: false,
        relevanceScore: 50,
        evidenceSnippets: [],
      };
    }

    const speechLower = candidateSpeech.toLowerCase();

    // 1. Trích xuất các số liệu / chỉ số cụ thể từ phát ngôn của thí sinh
    const numberRegex = /(\d+([.,]\d+)?\s*(%|triệu|tỷ|usd|vnđ|vnd|người|khách|tháng|năm|đ|k)?)/gi;
    const spokenNumbers = (candidateSpeech.match(numberRegex) || [])
      .map((n) => n.trim())
      .filter((n) => n.length > 1 && !/^[0-9]$/.test(n)); // Lọc bỏ số đơn lẻ vô nghĩa

    // 2. Lớp 1: Khoanh vùng các khối đề mục theo phân công của Giám khảo
    const targetSectionTypes = BOSS_TO_SECTION_MAP[bossId] || [];
    const primarySections = sections.filter((s) => targetSectionTypes.includes(s.type));
    const secondarySections = sections.filter((s) => !targetSectionTypes.includes(s.type));

    // 3. Lớp 2 & 3: So khớp từ khóa và số liệu trong Khối đề mục chính
    const matchedNumbers: string[] = [];
    const matchedSections: string[] = [];
    const evidenceSnippets: string[] = [];
    let overlapTokenCount = 0;

    // Tách từ khóa của thí sinh (độ dài >= 3)
    const speechTokens = speechLower
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !['nhưng', 'chúng', 'trong', 'được', 'người', 'những', 'không'].includes(t));

    for (const sec of primarySections) {
      const secContentLower = sec.content.toLowerCase();
      let hasMatchInSection = false;

      // So khớp số liệu
      for (const num of spokenNumbers) {
        const cleanNum = num.replace(/\s+/g, '').toLowerCase();
        if (secContentLower.includes(cleanNum) && !matchedNumbers.includes(num)) {
          matchedNumbers.push(num);
          hasMatchInSection = true;
        }
      }

      // Đếm từ khóa trùng khớp
      for (const token of speechTokens) {
        if (secContentLower.includes(token)) {
          overlapTokenCount++;
          hasMatchInSection = true;
        }
      }

      if (hasMatchInSection) {
        matchedSections.push(sec.title || sec.type);
        // Lấy một đoạn trích ngắn làm bằng chứng
        evidenceSnippets.push(sec.content.slice(0, 150) + '...');
      }
    }

    // 4. Lớp 4: NGUYÊN TẮC SUY ĐOÁN VÔ TỘI (IN DUBIO PRO REO)
    // Nếu có số liệu thí sinh nêu mà KHÔNG thấy ở khối chính, quét toàn bộ các khối thứ cấp
    let inDubioProReoApplied = false;
    if (matchedNumbers.length < spokenNumbers.length) {
      for (const sec of secondarySections) {
        const secContentLower = sec.content.toLowerCase();
        for (const num of spokenNumbers) {
          if (!matchedNumbers.includes(num)) {
            const cleanNum = num.replace(/\s+/g, '').toLowerCase();
            if (secContentLower.includes(cleanNum)) {
              matchedNumbers.push(num);
              inDubioProReoApplied = true;
              matchedSections.push(`${sec.title || sec.type} (Phát hiện chéo)`);
              evidenceSnippets.push(`[In Dubio Pro Reo]: ${sec.content.slice(0, 150)}...`);
              this.logger.log(`[In Dubio Pro Reo] Tìm thấy số liệu "${num}" tại đề mục chéo "${sec.title || sec.type}"`);
            }
          }
        }
      }
    }

    // 5. Tính toán điểm liên quan căn cứ (Relevance / Factual Backing Score)
    const numberBonus = matchedNumbers.length * 20;
    const tokenScore = Math.min(60, overlapTokenCount * 5);
    const relevanceScore = Math.min(100, Math.max(30, tokenScore + numberBonus));

    const hasFactualSupport = matchedNumbers.length > 0 || overlapTokenCount >= 4;

    return {
      hasFactualSupport,
      matchedSections,
      supportedNumbers: matchedNumbers,
      inDubioProReoApplied,
      relevanceScore,
      evidenceSnippets: evidenceSnippets.slice(0, 3),
    };
  }
}
