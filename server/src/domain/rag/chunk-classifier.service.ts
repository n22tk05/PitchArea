import { Injectable, Logger } from '@nestjs/common';
import {
  BusinessWhitelistCategory,
  PitchGraphNode,
  PitchSectionType,
} from '@pitcharena/shared';

export interface ChunkClassificationResult {
  isNoise: boolean;
  routing: 'REFINED' | 'STAGING' | 'DISCARDED';
  sectionType: PitchSectionType;
  category: BusinessWhitelistCategory | 'OTHER';
  similarityScore: number;
  matchedBaselineKey?: string;
}

@Injectable()
export class ChunkClassifierService {
  private readonly logger = new Logger(ChunkClassifierService.name);

  // Ngưỡng tương đồng tối thiểu để đưa vào Refined Layer (FR-04: >= 65%)
  public static readonly REFINED_SIMILARITY_THRESHOLD = 0.65;

  // 5 Section cốt lõi mặc định của đề án khởi nghiệp (dùng khi chưa có hoặc chưa tải tài liệu Word)
  public static readonly DEFAULT_BASELINE_SECTIONS: Array<{
    sectionType: PitchSectionType;
    keywords: string[];
  }> = [
    {
      sectionType: PitchSectionType.PROBLEM_MARKET,
      keywords: ['thị trường', 'vấn đề', 'nỗi đau', 'khách hàng', 'quy mô', 'nhu cầu', 'medtech', 'dân số', 'bệnh nhân'],
    },
    {
      sectionType: PitchSectionType.SOLUTION_PRODUCT,
      keywords: ['giải pháp', 'sản phẩm', 'tính năng', 'công nghệ', 'ứng dụng', 'ai', 'phần mềm', 'thiết bị', 'báo cáo', 'tự động'],
    },
    {
      sectionType: PitchSectionType.BUSINESS_MODEL_UNIT_ECONOMICS,
      keywords: ['mô hình', 'kinh doanh', 'doanh thu', 'lợi nhuận', 'chi phí', 'giá bán', 'b2b', 'b2c', 'triệu', 'tỷ', 'hòa vốn', 'saas'],
    },
    {
      sectionType: PitchSectionType.COMPETITION_MOAT,
      keywords: ['đối thủ', 'cạnh tranh', 'lợi thế', 'khác biệt', 'rào cản', 'độc quyền', 'sở hữu trí tuệ'],
    },
    {
      sectionType: PitchSectionType.SOCIAL_IMPACT_ROADMAP,
      keywords: ['xã hội', 'tác động', 'lộ trình', 'môi trường', 'cộng đồng', 'phát triển', 'việc làm', 'bền vững'],
    },
  ];

  // 1. Regex nhận diện lời chào hỏi và giao đãi mở đầu/kết thúc
  private readonly GREETING_PATTERNS = [
    /^(?:kính\s*)?chào\s*(?:quý\s*)?(?:thầy\s*cô|ban\s*giám\s*khảo|bgk|anh\s*chị|quý\s*vị|hội\s*đồng|các\s*vị|mọi\s*người)/i,
    /^(?:kính\s*)?chào\b/i,
    /^(?:em|chúng\s*em|tôi)\s*(?:xin\s*phép|xin\s*chào|xin\s*cảm\s*ơn)/i,
    /^(?:cảm\s*ơn|xin\s*cảm\s*ơn)\s*(?:quý\s*)?(?:ban\s*giám\s*khảo|thầy\s*cô|quý\s*vị|hội\s*đồng)/i,
    /^(?:sau\s*đây|tiếp\s*theo)\s*(?:em|chúng\s*em)\s*xin\s*(?:phép|trình\s*bày)/i,
    /^chúc\s*(?:quý\s*)?(?:ban\s*giám\s*khảo|thầy\s*cô|hội\s*đồng)\s*một\s*ngày/i,
  ];

  // 2. Regex nhận diện câu cảm thán, ngập ngừng, than thở, filler words
  private readonly FILLER_NOISE_PATTERNS = [
    /^(?:ừm|ờ|à|ơ|dạ\s*vâng|vâng\s*ạ|nói\s*chung\s*là|thì\s*là\s*mà)\b/i,
    /(?:em\s*hơi\s*run|xin\s*lỗi\s*em\s*quên|đợi\s*em\s*chút|cho\s*em\s*nghĩ\s*lại)/i,
    /^(?:dạ|vâng|alo|alo\s*alo|test\s*mic|nghe\s*rõ\s*không)\b/i,
  ];

  // 3. Từ điển Whitelist nhận diện 5 nhóm Business Whitelist
  private readonly WHITELIST_RULES: Array<{
    category: BusinessWhitelistCategory;
    regex: RegExp;
  }> = [
    {
      category: BusinessWhitelistCategory.FINANCIAL_METRIC,
      regex:
        /(?:doanh\s*thu|lợi\s*nhuận|chi\s*phí|định\s*giá|hòa\s*vốn|vốn\s*đầu\s*tư|biên\s*lợi\s*nhuận|burn\s*rate|cac|ltv|mrr|arr|triệu\s*(?:đồng|vnd)?|tỷ\s*(?:đồng|vnd)?|\b\d+[\.,]?\d*\s*%(?:\s*lãi|\s*tăng\s*trưởng)?|\b\d+[\.,]?\d*\s*(?:triệu|tỷ|usd|vnd|k)\b)/i,
    },
    {
      category: BusinessWhitelistCategory.MARKET_EXPANSION,
      regex:
        /(?:mở\s*rộng\s*thị\s*trường|thị\s*trường\s*(?:mới|mục\s*tiêu|ngách|đông\s*nam\s*á|quốc\s*tế|nông\s*thôn)|phân\s*khúc\s*khách\s*hàng|tam|sam|som|quy\s*mô\s*thị\s*trường|xuất\s*khẩu|địa\s*bàn|thị\s*phần)/i,
    },
    {
      category: BusinessWhitelistCategory.NEW_FEATURE,
      regex:
        /(?:tính\s*năng\s*(?:mới|đột\s*phá|bổ\s*sung)|công\s*nghệ\s*(?:ai|mới|blockchain|iot|llm)|thuật\s*toán|ứng\s*dụng\s*(?:mobile|di\s*động|web)|module|tự\s*động\s*hóa|phiên\s*bản\s*2\.0|nâng\s*cấp)/i,
    },
    {
      category: BusinessWhitelistCategory.CHANNEL_PARTNER,
      regex:
        /(?:kênh\s*(?:phân\s*phối|bán\s*hàng|b2b|b2c|b2g|online|offline)|đối\s*tác\s*(?:chiến\s*lược|hợp\s*tác)|đại\s*lý|nhà\s*thuốc|bệnh\s*viện|trường\s*học|nhà\s*cung\s*cấp|nhượng\s*quyền|chuỗi\s*cửa\s*hàng)/i,
    },
    {
      category: BusinessWhitelistCategory.TIMELINE_ROADMAP,
      regex:
        /(?:lộ\s*trình|mốc\s*thời\s*gian|giai\s*đoạn|roadmap|quý\s*[1-4]|q[1-4]|tháng\s*\d{1,2}(?:\/\d{4})?|năm\s*202[4-9]|sau\s*\d+\s*tháng|ra\s*mắt|triển\s*khai)/i,
    },
  ];

  private static readonly VIETNAMESE_STOP_WORDS = new Set([
    'và', 'của', 'các', 'cho', 'với', 'trong', 'được', 'này', 'đó', 'là',
    'những', 'một', 'thì', 'mà', 'ở', 'đến', 'từ', 'vào', 'khi', 'để',
    'chúng', 'tôi', 'em', 'mình', 'có', 'cũng', 'đã', 'sẽ', 'đang'
  ]);

  /**
   * Kiểm tra câu có phải lời chào hỏi, cảm thán hoặc nhiễu không mang giá trị kinh doanh
   */
  public isConversationalNoise(text: string): boolean {
    const trimmed = text.trim();
    if (!trimmed) return true;

    // Quá ngắn (< 3 từ) và không chứa số hay ký tự tài chính
    const words = trimmed.split(/\s+/).filter(Boolean);
    if (words.length < 3 && !/\d|%|\$|triệu|tỷ/i.test(trimmed)) {
      return true;
    }

    // NẾU CÂU CÓ CHỨA NỘI DUNG BUSINESS WHITELIST RÕ RÀNG: TUYỆT ĐỐI KHÔNG BỎ QUA
    // (Bảo vệ các câu nói lịch sự của thí sinh như "Dạ doanh thu 5 tỷ...", "Em xin phép trình bày tính năng AI...")
    if (this.classifyWhitelistCategory(trimmed) !== null) {
      return false;
    }

    // Khớp mẫu chào hỏi
    for (const pattern of this.GREETING_PATTERNS) {
      if (pattern.test(trimmed)) return true;
    }

    // Khớp mẫu cảm thán, ngập ngừng
    for (const pattern of this.FILLER_NOISE_PATTERNS) {
      if (pattern.test(trimmed)) return true;
    }

    return false;
  }

  /**
   * Phân loại Business Whitelist theo từ điển chuyên ngành
   */
  public classifyWhitelistCategory(
    text: string
  ): BusinessWhitelistCategory | null {
    for (const rule of this.WHITELIST_RULES) {
      if (rule.regex.test(text)) {
        return rule.category;
      }
    }
    return null;
  }

  /**
   * Đo độ tương đồng ngữ nghĩa Token Jaccard giữa câu phát biểu và các node Word Baseline
   */
  public matchBestBaselineSection(
    chunkText: string,
    baselineNodes: PitchGraphNode[]
  ): {
    bestSection: PitchSectionType;
    similarity: number;
    matchedNode?: PitchGraphNode;
  } {
    const chunkTokens = this.tokenize(chunkText);
    if (!chunkTokens.size) {
      return {
        bestSection: PitchSectionType.PROBLEM_MARKET,
        similarity: 0,
      };
    }

    // Nếu không có node baseline từ file Word, so khớp với 5 Section cốt lõi mặc định
    if (!baselineNodes.length) {
      // Nhận diện các từ khóa biểu thị ý tưởng mở rộng/phát sinh mới (Khối 6)
      const hasExpansionIndicator =
        /(?:mở\s*rộng|bổ\s*sung|phát\s*triển\s*thêm|ngoài\s*ra|thêm\s*vào|mới\s*tinh|kênh\s*mới|thị\s*trường\s*mới|đối\s*tác\s*mới|chưa\s*có\s*trong\s*hồ\s*sơ)/i.test(
          chunkText
        );

      if (hasExpansionIndicator) {
        // Có dấu hiệu mở rộng -> Cho độ tương đồng thấp (0.2) để chuyển tiếp sang Whitelist Staging
        return {
          bestSection: PitchSectionType.DYNAMIC_EXPANDED_SCOPE,
          similarity: 0.2,
        };
      }

      let bestSim = 0;
      let matchedSection: PitchSectionType = PitchSectionType.PROBLEM_MARKET;

      for (const section of ChunkClassifierService.DEFAULT_BASELINE_SECTIONS) {
        let matchCount = 0;
        for (const kw of section.keywords) {
          if (chunkText.toLowerCase().includes(kw)) {
            matchCount += 1;
          }
        }
        if (matchCount > 0) {
          const score = Math.min(1.0, 0.65 + matchCount * 0.15);
          if (score > bestSim) {
            bestSim = score;
            matchedSection = section.sectionType;
          }
        }
      }

      return {
        bestSection: matchedSection,
        similarity: Number(bestSim.toFixed(4)),
      };
    }

    let bestSimilarity = 0;
    let bestSection: PitchSectionType = PitchSectionType.PROBLEM_MARKET;
    let matchedNode: PitchGraphNode | undefined;

    for (const node of baselineNodes) {
      const nodeText = `${node.key} ${node.value} ${node.originalSentence || ''}`;
      const nodeTokens = this.tokenize(nodeText);

      const sim = this.calculateJaccardSimilarity(chunkTokens, nodeTokens);
      if (sim > bestSimilarity) {
        bestSimilarity = sim;
        bestSection = node.sectionType;
        matchedNode = node;
      }
    }

    return {
      bestSection,
      similarity: Number(bestSimilarity.toFixed(4)),
      matchedNode,
    };
  }

  /**
   * Phân luồng 2 nhánh (Bifurcated Routing) theo yêu cầu FR-04:
   * - Lọc rác/chào hỏi -> DISCARDED
   * - Tương đồng >= 65% -> REFINED
   * - Tương đồng < 65% + Whitelist -> STAGING
   * - Khác -> DISCARDED (không gom Khối 6)
   */
  public classifyChunk(
    chunkText: string,
    baselineNodes: PitchGraphNode[]
  ): ChunkClassificationResult {
    // 1. Kiểm tra rác hội thoại
    if (this.isConversationalNoise(chunkText)) {
      return {
        isNoise: true,
        routing: 'DISCARDED',
        sectionType: PitchSectionType.PROBLEM_MARKET,
        category: 'OTHER',
        similarityScore: 0,
      };
    }

    // 2. So khớp tương đồng với các section Word
    const { bestSection, similarity, matchedNode } = this.matchBestBaselineSection(
      chunkText,
      baselineNodes
    );

    // 3. Nhánh 1: Tương đồng cao >= 65% -> Thuộc Refined Layer
    if (similarity >= ChunkClassifierService.REFINED_SIMILARITY_THRESHOLD) {
      const whitelistCat = this.classifyWhitelistCategory(chunkText) || 'OTHER';
      return {
        isNoise: false,
        routing: 'REFINED',
        sectionType: bestSection,
        category: whitelistCat,
        similarityScore: similarity,
        matchedBaselineKey: matchedNode?.key,
      };
    }

    // 4. Nhánh 2: Tương đồng thấp < 65% -> Kiểm tra Business Whitelist Gate
    const whitelistCategory = this.classifyWhitelistCategory(chunkText);
    if (whitelistCategory) {
      // Hợp lệ Whitelist -> Đưa vào Staging Buffer (chờ khai sinh Khối 6)
      return {
        isNoise: false,
        routing: 'STAGING',
        sectionType: PitchSectionType.DYNAMIC_EXPANDED_SCOPE,
        category: whitelistCategory,
        similarityScore: similarity,
        matchedBaselineKey: matchedNode?.key,
      };
    }

    // Không khớp Whitelist -> Đánh dấu DISCARDED (OTHER, không đưa vào Khối 6)
    return {
      isNoise: false,
      routing: 'DISCARDED',
      sectionType: bestSection,
      category: 'OTHER',
      similarityScore: similarity,
    };
  }

  /**
   * Tách từ tiếng Việt đơn giản (chuẩn hóa thường, bỏ dấu câu và stop words)
   */
  private tokenize(text: string): Set<string> {
    const normalized = text
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'<>]/g, ' ')
      .trim();

    const rawTokens = normalized.split(/\s+/).filter((w) => w.length > 1);
    const filteredTokens = rawTokens.filter(
      (token) => !ChunkClassifierService.VIETNAMESE_STOP_WORDS.has(token)
    );

    return new Set(filteredTokens.length ? filteredTokens : rawTokens);
  }

  /**
   * Tính độ đo Jaccard / Overlap coefficient
   */
  private calculateJaccardSimilarity(
    setA: Set<string>,
    setB: Set<string>
  ): number {
    if (!setA.size || !setB.size) return 0;

    let intersectionCount = 0;
    for (const token of setA) {
      if (setB.has(token)) {
        intersectionCount += 1;
      }
    }

    // Overlap coefficient: intersection / min(|A|, |B|) giúp câu ngắn khớp tốt với đoạn dài
    const minSize = Math.min(setA.size, setB.size);
    if (minSize === 0) return 0;

    return intersectionCount / minSize;
  }
}
