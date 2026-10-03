import {
  BusinessSectionType,
  BusinessSectionLabel,
  DocumentSection,
} from '@pitcharena/shared';

interface KeywordRule {
  type: BusinessSectionType;
  keywords: RegExp[];
}

const SECTION_RULES: KeywordRule[] = [
  {
    type: BusinessSectionType.PROBLEM_MARKET,
    keywords: [
      /vấn đề/i,
      /thị trường/i,
      /khách hàng mục tiêu/i,
      /nỗi đau/i,
      /bối cảnh/i,
      /problem/i,
      /market size/i,
      /tam/i,
      /sam/i,
      /som/i,
    ],
  },
  {
    type: BusinessSectionType.SOLUTION_PRODUCT,
    keywords: [
      /giải pháp/i,
      /sản phẩm/i,
      /tính năng/i,
      /công nghệ/i,
      /kiến trúc/i,
      /solution/i,
      /product/i,
      /technology/i,
      /core feature/i,
    ],
  },
  {
    type: BusinessSectionType.BUSINESS_MODEL_UNIT_ECONOMICS,
    keywords: [
      /mô hình kinh doanh/i,
      /doanh thu/i,
      /chi phí/i,
      /tài chính/i,
      /định giá/i,
      /unit economics/i,
      /cac/i,
      /ltv/i,
      /revenue/i,
      /pricing/i,
      /cost structure/i,
    ],
  },
  {
    type: BusinessSectionType.COMPETITION_MOAT,
    keywords: [
      /đối thủ/i,
      /cạnh tranh/i,
      /lợi thế/i,
      /khác biệt/i,
      /rào cản/i,
      /moat/i,
      /competitor/i,
      /competitive/i,
      /differentiation/i,
    ],
  },
  {
    type: BusinessSectionType.SOCIAL_IMPACT_ROADMAP,
    keywords: [
      /lộ trình/i,
      /kế hoạch/i,
      /tác động/i,
      /xã hội/i,
      /cột mốc/i,
      /đội ngũ/i,
      /roadmap/i,
      /milestone/i,
      /impact/i,
      /team/i,
    ],
  },
];

export class SectionChunker {
  /**
   * Phân chia nội dung Markdown thành 5 khối đề mục kinh doanh
   */
  public static chunk(markdown: string): DocumentSection[] {
    const lines = markdown.split('\n');
    const sectionsMap = new Map<BusinessSectionType, string[]>();

    // Khởi tạo các mảng cho 5 khối
    Object.values(BusinessSectionType).forEach((type) => {
      sectionsMap.set(type, []);
    });

    let currentSection: BusinessSectionType = BusinessSectionType.PROBLEM_MARKET;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      // Kiểm tra xem dòng có phải là tiêu đề (Heading) hoặc dòng chứa từ khóa phân mục không
      const matchedType = SectionChunker.detectSectionType(line);
      if (matchedType) {
        currentSection = matchedType;
      }

      sectionsMap.get(currentSection)!.push(rawLine);
    }

    // Chuyển đổi sang mảng DocumentSection
    const result: DocumentSection[] = [];

    Object.values(BusinessSectionType).forEach((type, index) => {
      const contentLines = sectionsMap.get(type) || [];
      const content = contentLines.join('\n').trim();

      result.push({
        id: `sec-${index + 1}-${type.toLowerCase()}`,
        type,
        title: BusinessSectionLabel[type],
        content: content || `(Chưa có nội dung chi tiết cho phần ${BusinessSectionLabel[type]})`,
        charCount: content.length,
        wordCount: content.split(/\s+/).filter(Boolean).length,
      });
    });

    return result;
  }

  private static detectSectionType(line: string): BusinessSectionType | null {
    const isHeading = /^#{1,4}\s+/.test(line) || /^[0-9IVX]+\.\s+/i.test(line);

    for (const rule of SECTION_RULES) {
      for (const kw of rule.keywords) {
        if (kw.test(line)) {
          // Nếu là Heading thì độ ưu tiên cao, hoặc nếu dòng ngắn có từ khóa chính
          if (isHeading || line.length < 80) {
            return rule.type;
          }
        }
      }
    }

    return null;
  }
}
