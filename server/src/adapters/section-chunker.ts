import {
  BusinessSectionType,
  BusinessSectionLabel,
  DocumentSection,
} from '@pitcharena/shared';

// Bảng từ khóa nhận diện đề mục theo chuỗi chuẩn hóa, bao quát cả tiếng Việt và tiếng Anh
const SECTION_KEYWORDS: Record<BusinessSectionType, string[]> = {
  [BusinessSectionType.PROBLEM_MARKET]: [
    'vấn đề',
    'thị trường',
    'khách hàng',
    'nỗi đau',
    'bối cảnh',
    'tính cấp thiết',
    'quy mô',
    'problem',
    'market',
    'target customer',
    'pain point',
    'tam',
    'sam',
    'som',
  ],
  [BusinessSectionType.SOLUTION_PRODUCT]: [
    'giải pháp',
    'sản phẩm',
    'tính năng',
    'công nghệ',
    'kiến trúc',
    'kỹ thuật',
    'hệ thống',
    'solution',
    'product',
    'technology',
    'architecture',
    'core feature',
  ],
  [BusinessSectionType.BUSINESS_MODEL_UNIT_ECONOMICS]: [
    'mô hình kinh doanh',
    'doanh thu',
    'chi phí',
    'tài chính',
    'định giá',
    'dòng tiền',
    'lợi nhuận',
    'business model',
    'revenue',
    'cost',
    'pricing',
    'financial',
    'cac',
    'ltv',
    'unit economics',
  ],
  [BusinessSectionType.COMPETITION_MOAT]: [
    'đối thủ',
    'cạnh tranh',
    'lợi thế',
    'khác biệt',
    'rào cản',
    'phòng thủ',
    'competitor',
    'competition',
    'competitive',
    'moat',
    'differentiation',
  ],
  [BusinessSectionType.SOCIAL_IMPACT_ROADMAP]: [
    'lộ trình',
    'kế hoạch',
    'tác động',
    'xã hội',
    'cột mốc',
    'đội ngũ',
    'nhân sự',
    'triển khai',
    'roadmap',
    'milestone',
    'impact',
    'team',
    'execution plan',
  ],
};

export class SectionChunker {
  /**
   * Phân chia nội dung Markdown thành 5 khối đề mục kinh doanh
   * Dựa trên cấu trúc Heading thực thụ của tài liệu (tránh quét nhầm thân bài)
   */
  public static chunk(markdown: string): DocumentSection[] {
    const lines = markdown.split('\n');
    const sectionsMap = new Map<BusinessSectionType, string[]>();

    // Khởi tạo danh sách cho cả 5 phân mục
    Object.values(BusinessSectionType).forEach((type) => {
      sectionsMap.set(type, []);
    });

    let currentSection: BusinessSectionType | null = null;
    const preambleLines: string[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      // CHỈ xem xét đổi Section khi dòng hiện tại là TIÊU ĐỀ (Heading thực sự)
      if (SectionChunker.isHeadingLine(line)) {
        const detectedType = SectionChunker.matchSectionType(line);
        if (detectedType) {
          currentSection = detectedType;
        }
      }

      if (currentSection) {
        sectionsMap.get(currentSection)!.push(rawLine);
      } else {
        preambleLines.push(rawLine);
      }
    }

    // Nếu không tìm thấy heading nào, phân bổ preamble cho PROBLEM_MARKET để dự án vẫn có nội dung tối thiểu
    const anySectionFound = Array.from(sectionsMap.values()).some((arr) => arr.length > 0);
    if (!anySectionFound && preambleLines.length > 0) {
      sectionsMap.set(BusinessSectionType.PROBLEM_MARKET, preambleLines);
    }

    // Chuyển đổi sang mảng DocumentSection chuẩn
    return Object.values(BusinessSectionType).map((type, index) => {
      const rawContent = (sectionsMap.get(type) || []).join('\n').trim();
      const isDetected =
        rawContent.length > 30 &&
        !rawContent.includes('Chưa phát hiện nội dung rõ ràng cho mục');

      return {
        id: `sec-${index + 1}-${type.toLowerCase()}`,
        type,
        title: BusinessSectionLabel[type],
        content:
          rawContent ||
          `(Chưa phát hiện nội dung rõ ràng cho mục ${BusinessSectionLabel[type]})`,
        charCount: rawContent.length,
        wordCount: rawContent.split(/\s+/).filter(Boolean).length,
        isDetected,
      };
    });
  }

  /**
   * Nhận diện xem một dòng có phải là Tiêu đề hay không:
   * 1. Markdown heading (#, ##, ###, ####)
   * 2. Đánh số đề mục (1., 1.1, I., II., Phần 1, Chương 2, Mục 3)
   * 3. Chữ in đậm nguyên dòng (**Tiêu đề**) có độ dài dưới 90 ký tự
   */
  private static isHeadingLine(line: string): boolean {
    const isMarkdownHeading = /^#{1,4}\s+/.test(line);
    const isNumberedHeading =
      /^(phần|chương|mục|bước)?\s*([0-9]+(\.[0-9]+)*|[ivx]+)\s*[\.\:\-]/i.test(
        line
      );
    const isBoldHeading = /^\*\*[^*]+\*\*$/.test(line) && line.length < 90;

    return isMarkdownHeading || isNumberedHeading || isBoldHeading;
  }

  /**
   * So khớp tiêu đề với 5 nhóm phân mục kinh doanh
   */
  private static matchSectionType(heading: string): BusinessSectionType | null {
    const normalized = heading.toLowerCase();

    for (const [type, keywords] of Object.entries(SECTION_KEYWORDS) as [
      BusinessSectionType,
      string[]
    ][]) {
      for (const kw of keywords) {
        // Với các từ viết tắt ngắn (<= 4 ký tự như tam, sam, som, cac, ltv), bắt buộc kiểm tra ranh giới từ nguyên vẹn \b
        if (kw.length <= 4) {
          const wordBoundaryRegex = new RegExp(`(^|[^a-zA-Z0-9À-ỹ])${kw}([^a-zA-Z0-9À-ỹ]|$)`, 'i');
          if (wordBoundaryRegex.test(normalized)) {
            return type;
          }
        } else if (normalized.includes(kw)) {
          return type;
        }
      }
    }
    return null;
  }
}
