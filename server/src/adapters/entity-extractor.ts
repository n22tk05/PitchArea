import { generateObject } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import {
  BusinessSectionType,
  DocumentSection,
  EntityWhitelistItem,
} from '@pitcharena/shared';

// Zod Schema định nghĩa cấu trúc Entity cho Vercel AI SDK
const ExtractedEntitySchema = z.object({
  rawText: z
    .string()
    .describe('Đoạn văn bản gốc thể hiện số liệu, ví dụ: "15%", "$12", "2 tỷ VNĐ", "500 người dùng", "6 tháng"'),
  category: z
    .enum(['PERCENTAGE', 'CURRENCY', 'METRIC', 'DATE_TIMELINE', 'ENTITY_NAME'])
    .describe('Phân loại thực thể'),
  value: z.string().describe('Giá trị số liệu đã được chuẩn hóa'),
  contextSentence: z
    .string()
    .describe('Câu văn cụ thể trong tài liệu chứa số liệu này để làm căn cứ đối soát'),
  sectionType: z.enum([
    'PROBLEM_MARKET',
    'SOLUTION_PRODUCT',
    'BUSINESS_MODEL_UNIT_ECONOMICS',
    'COMPETITION_MOAT',
    'SOCIAL_IMPACT_ROADMAP',
  ]),
});

const ExtractionResponseSchema = z.object({
  entities: z.array(ExtractedEntitySchema),
});

export class EntityExtractor {
  /**
   * Trích xuất toàn diện số liệu Whitelist bằng Vercel AI SDK + Google Gemini Flash
   * Thay thế 100% các đoạn regex hardcode từ khóa, tự động hiểu ngữ nghĩa tiếng Việt.
   */
  public static async extract(
    sections: DocumentSection[]
  ): Promise<EntityWhitelistItem[]> {
    const apiKey =
      process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    // Chuẩn bị văn bản đầu vào gom theo 5 khối đề mục
    const aggregatedContent = sections
      .filter((s) => s.content && s.content.trim().length > 0)
      .map(
        (s) =>
          `[KHỐI CHUYÊN MÔN: ${s.type} - TIÊU ĐỀ: ${s.title}]\n${s.content}`
      )
      .join('\n\n---\n\n');

    if (!aggregatedContent || aggregatedContent.trim().length === 0) {
      return [];
    }

    // 1. NẾU CÓ GROQ_API_KEY: Ưu tiên Groq Model (openai/gpt-oss-120b) siêu nhanh, không chạm quota ngày
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey) {
      try {
        const groq = createOpenAI({
          baseURL: 'https://api.groq.com/openai/v1',
          apiKey: groqKey,
        });

        const { object } = await generateObject({
          model: groq.chat('openai/gpt-oss-120b'),
          schema: ExtractionResponseSchema as any,
          system: `Bạn là Chuyên gia Thẩm định Số liệu Dự án Khởi nghiệp (Pitch Deck Auditor). Trích xuất toàn bộ các thực thể số liệu tài chính, kỹ thuật, thị trường từ văn bản.`,
          prompt: `Trích xuất danh sách thực thể số liệu (Whitelist Entities) từ văn bản:\n\n${aggregatedContent}`,
        });

        console.log(
          `[EntityExtractor] 🚀 Groq (openai/gpt-oss-120b) đã trích xuất thành công ${(object as any).entities?.length || 0} thực thể số liệu.`
        );

        let counter = 1;
        return (object as any).entities.map((item: any) => ({
          id: `entity-${counter++}`,
          rawText: item.rawText,
          category: item.category as EntityWhitelistItem['category'],
          value: item.value,
          contextSentence: item.contextSentence,
          sectionType: item.sectionType as BusinessSectionType,
        }));
      } catch (groqErr: any) {
        console.warn(
          `[EntityExtractor] [FALLBACK] ⚠️ Groq API gặp sự cố: "${groqErr.message}". Tự động Fallback sang Google Gemini...`
        );
      }
    }

    // 2. NẾU CÓ GEMINI_API_KEY: Sử dụng Google Gemini
    if (apiKey) {
      try {
        const googleProvider = createGoogleGenerativeAI({
          apiKey,
        });

        const { object } = await generateObject({
          model: googleProvider('gemini-3.6-flash'),
          schema: ExtractionResponseSchema as any,
          maxRetries: 0,
          system: `Bạn là Chuyên gia Thẩm định Số liệu Dự án Khởi nghiệp (Pitch Deck Auditor).
Nhiệm vụ của bạn là bóc tách toàn bộ các số liệu, chỉ số tài chính, quy mô thị trường, chi phí, chỉ số kỹ thuật và mốc thời gian từ bài thuyết trình của sinh viên.
Tuyệt đối không bỏ sót các số liệu quan trọng như CAC, LTV, MAU, doanh thu, vốn gọi, tỷ lệ chuyển đổi, độ trễ hệ thống, số lượng mẫu khảo sát...
Chuẩn hóa và gán chính xác từng số liệu vào đúng khối đề tài chuyên môn tương ứng.`,
          prompt: `Hãy phân tích toàn bộ văn bản sau đây và trích xuất danh sách thực thể số liệu (Whitelist Entities):\n\n${aggregatedContent}`,
        });

        console.log(
          `[EntityExtractor] 🚀 Google Gemini (gemini-3.6-flash) đã trích xuất thành công ${(object as any).entities?.length || 0} thực thể số liệu.`
        );

        let counter = 1;
        return (object as any).entities.map((item: any) => ({
          id: `entity-${counter++}`,
          rawText: item.rawText,
          category: item.category as EntityWhitelistItem['category'],
          value: item.value,
          contextSentence: item.contextSentence,
          sectionType: item.sectionType as BusinessSectionType,
        }));
      } catch (err: any) {
        console.warn(
          `[EntityExtractor] [FALLBACK] ⚠️ Google Gemini gặp sự cố: "${err.message}". Tự động Fallback sang Generic Number-Unit Tokenizer...`
        );
      }
    }

    // FALLBACK TỰ ĐỘNG (Khi chưa cấu hình API Key hoặc lỗi mạng):
    console.warn(
      `[EntityExtractor] [FALLBACK] 🚨 Không thể trích xuất qua Cloud AI (Groq/Gemini). Đang kích hoạt Fallback Generic Number-Unit Tokenizer cục bộ...`
    );
    return this.fallbackGenericExtract(sections);
  }

  /**
   * Bộ trích xuất tổng quát dự phòng (Generic Number-Unit Tokenizer)
   * Không hardcode từ vựng riêng lẻ, nhận diện mọi cụm [Số] + [Đơn vị/Từ ngữ theo sau]
   */
  private static fallbackGenericExtract(
    sections: DocumentSection[]
  ): EntityWhitelistItem[] {
    const whitelist: EntityWhitelistItem[] = [];
    let counter = 1;

    // Pattern tổng quát: [$₫]? + [Số] + [% hoặc 1-2 từ ngữ theo sau]
    const genericNumberRegex =
      /(?:[$₫€¥£]\s*)?\b\d+(?:[.,]\d+)?\s*(?:%|[a-zA-ZÀ-ỹ]+(?:\s+[a-zA-ZÀ-ỹ]+)?)\b/gu;

    for (const section of sections) {
      if (!section.content) continue;

      const sentences = section.content
        .split(/(?<=[.?!;])\s+|\n+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 5);

      for (const sentence of sentences) {
        const matches = sentence.match(genericNumberRegex);
        if (matches) {
          for (const match of matches) {
            let category: EntityWhitelistItem['category'] = 'METRIC';
            if (match.includes('%')) {
              category = 'PERCENTAGE';
            } else if (/(đ|vnd|vnđ|\$|usd|tỷ|triệu)/i.test(match)) {
              category = 'CURRENCY';
            } else if (/(tháng|năm|quý|tuần|ngày|q[1-4])/i.test(match)) {
              category = 'DATE_TIMELINE';
            }

            whitelist.push({
              id: `entity-${counter++}`,
              rawText: match,
              category,
              value: match,
              contextSentence: sentence,
              sectionType: section.type,
            });
          }
        }
      }
    }

    // Khử trùng lặp
    const seen = new Set<string>();
    const deduplicated = whitelist.filter((item) => {
      const key = `${item.value.toLowerCase()}_${item.contextSentence.slice(0, 30)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(
      `[EntityExtractor] 🛠️ Generic Tokenizer cục bộ đã bóc tách thành công ${deduplicated.length} cụm số liệu chuẩn hóa.`
    );

    return deduplicated;
  }
}
