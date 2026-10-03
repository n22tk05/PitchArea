// Use CommonJS require to avoid TypeScript synthetic default import mismatch with mammoth
// eslint-disable-next-line @typescript-eslint/no-var-requires
import mammoth from 'mammoth';

export interface ParseDocxOptions {
  buffer: Buffer;
}

export interface ParseDocxResult {
  markdown: string;
  charCount: number;
  wordCount: number;
  hasImagesFiltered: boolean;
  parseTimeMs: number;
}

export class DocxParser {
  /**
   * Bóc tách file Word .docx sang Markdown sạch, lọc bỏ 100% hình ảnh
   */
  public static async parse(options: ParseDocxOptions): Promise<ParseDocxResult> {
    const startTime = performance.now();

    if (!options.buffer || !Buffer.isBuffer(options.buffer)) {
      throw new Error('Dữ liệu Buffer của tệp Word không hợp lệ.');
    }

    // Cấu hình mammoth với convertImage rỗng để không sinh Base64 trong bộ nhớ
    const result = await mammoth.convertToMarkdown(
      { buffer: options.buffer },
      {
        ignoreEmptyParagraphs: true,
        convertImage: mammoth.images ? mammoth.images.inline(() => Promise.resolve({ src: '' })) : undefined,
      }
    );

    let rawMarkdown = result.value || '';

    // Lọc sạch thẻ <img> hoặc chuỗi Base64 nếu còn sót
    const sanitizedMarkdown = rawMarkdown
      .replace(/!\[.*?\]\(.*?\)/g, '') // Markdown images
      .replace(/<img[^>]*>/gi, '') // HTML image tags
      .replace(/data:image\/[^;]+;base64,[^\s"')]+/gi, '') // Base64 data URIs
      .trim();

    const charCount = sanitizedMarkdown.length;
    const wordCount = sanitizedMarkdown.split(/\s+/).filter(Boolean).length;
    const parseTimeMs = Math.round(performance.now() - startTime);

    return {
      markdown: sanitizedMarkdown,
      charCount,
      wordCount,
      hasImagesFiltered: true,
      parseTimeMs,
    };
  }
}
