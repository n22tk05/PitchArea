import { Module } from '@nestjs/common';
import { ArenaGateway } from './arena.gateway';
import { ArenaFsmService } from '../domain/fsm/arena-fsm.service';
import { GeminiService } from '../adapters/llm/gemini.service';
import { FollowUpEngine } from '../domain/orchestrator/follow-up-engine';
import { DocumentModule } from '../document/document.module';
import { ScoringModule } from '../domain/scoring/scoring.module';

import { AppendixGeneratorService } from '../domain/reporting/appendix-generator.service';
import { RematchEngine } from '../domain/orchestrator/rematch-engine';
import { SessionPersistenceService } from '../adapters/db/session-persistence.service';
import { ArenaController } from './arena.controller';
import { PitchGraphService } from '../domain/rag/pitch-graph.service';
import { ChunkClassifierService } from '../domain/rag/chunk-classifier.service';
import { Section6BuilderService } from '../domain/rag/section6-builder.service';
import { DiffAlignmentService } from '../domain/rag/diff-alignment.service';

@Module({
  imports: [DocumentModule, ScoringModule],
  controllers: [ArenaController],
  providers: [
    ArenaGateway,
    ArenaFsmService,
    GeminiService,
    FollowUpEngine,
    AppendixGeneratorService,
    RematchEngine,
    SessionPersistenceService,
    PitchGraphService,
    ChunkClassifierService,
    Section6BuilderService,
    DiffAlignmentService,
  ],
  exports: [
    ArenaGateway,
    ArenaFsmService,
    AppendixGeneratorService,
    RematchEngine,
    SessionPersistenceService,
    PitchGraphService,
    ChunkClassifierService,
    Section6BuilderService,
    DiffAlignmentService,
  ],
})
export class ArenaModule {}
