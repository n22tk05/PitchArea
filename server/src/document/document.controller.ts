import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  HttpCode,
  HttpStatus,
  Get,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { existsSync, createReadStream } from 'fs';
import { join } from 'path';
import 'multer';
import { DocumentService } from './document.service';

@Controller('api/documents')
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Get('health')
  healthCheck() {
    return { status: 'ok', service: 'PitchArena NestJS Document Service' };
  }

  @Get('sample/download')
  downloadSampleDocument(@Res() res: Response) {
    const candidatePaths = [
      join(process.cwd(), 'client/public/samples/Thuyet_Minh_De_Tai_AI_Medical_Assistant.docx'),
      join(process.cwd(), 'test/fixtures/Thuyet_Minh_De_Tai_AI_Medical_Assistant.docx'),
      join(__dirname, '../../../../test/fixtures/Thuyet_Minh_De_Tai_AI_Medical_Assistant.docx'),
    ];
    const filePath = candidatePaths.find((p) => existsSync(p));
    if (!filePath) {
      throw new BadRequestException('Không tìm thấy tệp tài liệu mẫu.');
    }

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="Thuyet_Minh_De_Tai_AI_Medical_Assistant.docx"'
    );
    const stream = createReadStream(filePath);
    stream.pipe(res);
  }

  @Post('upload')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 20 * 1024 * 1024, // 20 MB max
      },
    })
  )
  async uploadDocument(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn tệp .docx để tải lên.');
    }

    const data = await this.documentService.processDocx(file);
    return {
      success: true,
      message: 'Bóc tách tài liệu thành công qua In-Memory RAG',
      data,
    };
  }
}
