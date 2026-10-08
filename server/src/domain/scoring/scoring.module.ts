import { Module } from '@nestjs/common';
import { RAGEngineService } from './rag-engine.service';
import { MADChamberService } from './mad-chamber.service';
import { ArbiterService } from './arbiter.service';
import { GeminiService } from '../../adapters/llm/gemini.service';
import { DocumentModule } from '../../document/document.module';

@Module({
  imports: [DocumentModule],
  providers: [RAGEngineService, MADChamberService, ArbiterService, GeminiService],
  exports: [RAGEngineService, MADChamberService, ArbiterService],
})
export class ScoringModule {}
