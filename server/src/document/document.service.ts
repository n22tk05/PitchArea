import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import 'multer';
import {
  DocumentAnalysisResult,
  DocumentSection,
  EntityWhitelistItem,
  BlindSpot,
} from '@pitcharena/shared';
import { DocxParser } from '../adapters/docx-parser';
import { SectionChunker } from '../adapters/section-chunker';
import { EntityExtractor } from '../adapters/entity-extractor';
import { BlindSpotDetector } from '../adapters/blind-spot-detector';

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);
  private readonly documents = new Map<string, DocumentAnalysisResult>();

  public getDocument(documentId: string): DocumentAnalysisResult | undefined {
    return this.documents.get(documentId);
  }

  /**
   * Giải mã tên tệp tiếng Việt / UTF-8 bị Multer parse nhầm thành ISO-8859-1 (Latin1)
   */
  private decodeFilename(filename?: string): string {
    if (!filename) return 'document.docx';
    try {
      const decoded = Buffer.from(filename, 'latin1').toString('utf8');
      if (decoded.includes('\uFFFD')) {
        return filename;
      }
      return decoded;
    } catch {
      return filename;
    }
  }

  async processDocx(file: Express.Multer.File): Promise<DocumentAnalysisResult> {
    if (!file) {
      throw new BadRequestException('Không tìm thấy tệp tải lên.');
    }

    const safeFilename = this.decodeFilename(file.originalname);

    if (!safeFilename.toLowerCase().endsWith('.docx')) {
      throw new BadRequestException('Chỉ chấp nhận tệp định dạng Word (.docx).');
    }

    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Dữ liệu tệp tải lên bị rỗng hoặc không đọc được.');
    }

    this.logger.log(`\n==================================================`);
    this.logger.log(`[DocumentService] 📥 Bắt đầu tiếp nhận tệp: "${safeFilename}" (${(file.size / 1024).toFixed(1)} KB)`);
    this.logger.log(`==================================================`);

    try {
      // 1. Parse Word docx sang Markdown sạch, lọc bỏ hình ảnh
      const parsed = await DocxParser.parse({ buffer: file.buffer });
      this.logger.log(
        `[DocumentService] ✅ [Bước 1/4] Đọc & Chuyển đổi DOCX -> Markdown thành công: ${parsed.wordCount} từ, ${parsed.charCount} ký tự (Thời gian parse: ${parsed.parseTimeMs}ms, đã lọc sạch ảnh).`
      );

      // 2. Chia 5 khối chuyên môn
      const sections: DocumentSection[] = SectionChunker.chunk(parsed.markdown);
      this.logger.log(
        `[DocumentService] ✅ [Bước 2/4] Phân rã thành công 5 khối chuyên môn (5 Business Sections):`
      );
      sections.forEach((sec, idx) => {
        this.logger.log(
          `   ├─ [Khối ${idx + 1}/5] ${sec.title}: ${sec.wordCount} từ`
        );
      });

      // 3. Trích xuất Entity Whitelist qua Vercel AI SDK
      this.logger.log(
        `[DocumentService] ⏳ [Bước 3/4] Đang trích xuất số liệu thực thể (Entity Whitelist)...`
      );
      const entityWhitelist: EntityWhitelistItem[] =
        await EntityExtractor.extract(sections);
      this.logger.log(
        `[DocumentService] ✅ [Bước 3/4] Trích xuất hoàn tất: ${entityWhitelist.length} thực thể số liệu được kiểm chứng.`
      );

      // 4. Phát hiện 3 điểm mù rủi ro
      this.logger.log(
        `[DocumentService] ⏳ [Bước 4/4] Đang phân tích các điểm mù rủi ro (Blind Spots)...`
      );
      const blindSpots: BlindSpot[] = BlindSpotDetector.detect(sections, entityWhitelist);
      this.logger.log(
        `[DocumentService] ✅ [Bước 4/4] Phát hiện thành công ${blindSpots.length} điểm mù trọng yếu:`
      );
      blindSpots.forEach((spot, idx) => {
        this.logger.log(
          `   ├─ [Điểm mù ${idx + 1}] [${spot.domain}] ${spot.title} (Mức độ: ${spot.severity})`
        );
      });

      const result: DocumentAnalysisResult = {
        documentId: `doc-${Date.now()}`,
        filename: safeFilename,
        fileSizeBytes: file.size,
        markdownContent: parsed.markdown,
        sections,
        entityWhitelist,
        blindSpots,
        processedAt: new Date().toISOString(),
      };

      this.logger.log(`==================================================`);
      this.logger.log(
        `[DocumentService] 🎉 Hoàn tất phân tích tệp "${safeFilename}" [ID: ${result.documentId}]. Sẵn sàng tải dữ liệu vào Sảnh đấu!`
      );
      this.logger.log(`==================================================\n`);

      this.documents.set(result.documentId, result);
      return result;
    } catch (err: any) {
      this.logger.error(`[DocumentService] ❌ Thất bại khi xử lý tệp: ${err.message || err}`);
      throw new BadRequestException(`Lỗi bóc tách tệp Word: ${err.message || err}`);
    }
  }
}
