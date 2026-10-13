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
    const matchedPhrases: string[] = [];

    // Danh sách từ dừng tiếng Việt mở rộng - loại bỏ các từ đệm và đại từ phổ biến
    const VIETNAMESE_STOP_WORDS = new Set([
      'rồi', 'thì', 'để', 'từ', 'mà', 'nó', 'tới', 'với', 'của', 'có', 'đúng',
      'như', 'sau', 'đầu', 'tiên', 'khi', 'chúng', 'ta', 'một', 'nước', 'được',
      'cái', 'ví_dụ', 'ví', 'dụ', 'sẽ', 'vào', 'và', 'là', 'trong', 'những',
      'người', 'không', 'nhưng', 'các', 'cho', 'này', 'đó', 'lại', 'ra', 'qua',
      'bị', 'do', 'ở', 'lên', 'xuống', 'về', 'hay', 'hoặc', 'nếu', 'vì', 'bởi',
      'rất', 'quá', 'lắm', 'luôn', 'ngay', 'đang', 'đã', 'hãy', 'nên', 'cần',
      'phải', 'mình', 'em', 'nhóm', 'thực', 'hiện', 'tại', 'thế', 'vậy', 'kia'
    ]);

    // Trích xuất các cụm từ ghép 2 từ liền kề (Bigrams) có ý nghĩa chuyên môn
    const rawWords = speechLower
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 0);

    const compoundPhrases: string[] = [];
    for (let i = 0; i < rawWords.length - 1; i++) {
      const w1 = rawWords[i];
      const w2 = rawWords[i + 1];
      if (!VIETNAMESE_STOP_WORDS.has(w1) && !VIETNAMESE_STOP_WORDS.has(w2) && w1.length >= 2 && w2.length >= 2) {
        compoundPhrases.push(`${w1} ${w2}`);
      }
    }

    // Lọc các từ đơn có nghĩa kỹ thuật/nghiệp vụ (không nằm trong stop words và độ dài >= 3)
    const substantiveSingleTokens = rawWords.filter(
      (w) => w.length >= 3 && !VIETNAMESE_STOP_WORDS.has(w)
    );

    let overlapTokenCount = 0;

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

      // So khớp cụm từ ghép có nghĩa
      for (const phrase of compoundPhrases) {
        if (secContentLower.includes(phrase) && !matchedPhrases.includes(phrase)) {
          matchedPhrases.push(phrase);
          hasMatchInSection = true;
        }
      }

      // Đếm từ đơn thực chất
      for (const token of substantiveSingleTokens) {
        if (secContentLower.includes(token)) {
          overlapTokenCount++;
        }
      }

      if (hasMatchInSection) {
        matchedSections.push(sec.title || sec.type);
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
    // - Có số liệu xác thực: thưởng lớn (25đ / số)
    // - Khớp cụm từ ghép chuyên ngành: (10đ / cụm)
    // - Chỉ khớp từ đơn rời rạc không có số liệu: KHÔNG thể tự động đạt điểm cao
    const numberScore = matchedNumbers.length * 25;
    const phraseScore = Math.min(40, matchedPhrases.length * 10);
    const singleTokenBonus = Math.min(15, overlapTokenCount * 2);

    let relevanceScore = 20; // Mặc định thấp nếu không có căn cứ
    if (matchedNumbers.length > 0) {
      relevanceScore = Math.min(100, Math.max(50, 40 + numberScore + phraseScore));
    } else if (matchedPhrases.length >= 2) {
      relevanceScore = Math.min(65, Math.max(30, 25 + phraseScore + singleTokenBonus));
    } else {
      relevanceScore = Math.min(35, 20 + singleTokenBonus);
    }

    // Chỉ công nhận có căn cứ tài liệu khi:
    // (a) Có số liệu khớp thực tế, HOẶC
    // (b) Khớp ít nhất 3 cụm từ ghép chuyên môn cụ thể của khối đề mục
    const hasFactualSupport = matchedNumbers.length > 0 || matchedPhrases.length >= 3;

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
