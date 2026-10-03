import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  HttpCode,
  HttpStatus,
  Get,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import 'multer';
import { DocumentService } from './document.service';

@Controller('api/documents')
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Get('health')
  healthCheck() {
    return { status: 'ok', service: 'PitchArena NestJS Document Service' };
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
