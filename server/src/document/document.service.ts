import { Injectable, BadRequestException } from '@nestjs/common';
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
  async processDocx(file: Express.Multer.File): Promise<DocumentAnalysisResult> {
    if (!file) {
      throw new BadRequestException('Không tìm thấy tệp tải lên.');
    }

    if (!file.originalname.toLowerCase().endsWith('.docx')) {
      throw new BadRequestException('Chỉ chấp nhận tệp định dạng Word (.docx).');
    }

    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Dữ liệu tệp tải lên bị rỗng hoặc không đọc được.');
    }

    try {
      // 1. Parse Word docx sang Markdown sạch, lọc bỏ hình ảnh
      const parsed = await DocxParser.parse({ buffer: file.buffer });

      // 2. Chia 5 khối chuyên môn
      const sections: DocumentSection[] = SectionChunker.chunk(parsed.markdown);

      // 3. Trích xuất Entity Whitelist qua Vercel AI SDK
      const entityWhitelist: EntityWhitelistItem[] =
        await EntityExtractor.extract(sections);

      // 4. Phát hiện 3 điểm mù rủi ro
      const blindSpots: BlindSpot[] = BlindSpotDetector.detect(sections, entityWhitelist);

      const result: DocumentAnalysisResult = {
        documentId: `doc-${Date.now()}`,
        filename: file.originalname,
        fileSizeBytes: file.size,
        markdownContent: parsed.markdown,
        sections,
        entityWhitelist,
        blindSpots,
        processedAt: new Date().toISOString(),
      };

      return result;
    } catch (err: any) {
      throw new BadRequestException(`Lỗi bóc tách tệp Word: ${err.message || err}`);
    }
  }
}
