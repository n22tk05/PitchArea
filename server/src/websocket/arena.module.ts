import { Module } from '@nestjs/common';
import { ArenaGateway } from './arena.gateway';
import { ArenaFsmService } from '../domain/fsm/arena-fsm.service';
import { GeminiService } from '../adapters/llm/gemini.service';
import { FollowUpEngine } from '../domain/orchestrator/follow-up-engine';
import { DocumentModule } from '../document/document.module';
import { ScoringModule } from '../domain/scoring/scoring.module';

@Module({
  imports: [DocumentModule, ScoringModule],
  providers: [
    ArenaGateway,
    ArenaFsmService,
    GeminiService,
    FollowUpEngine,
  ],
  exports: [ArenaGateway, ArenaFsmService],
})
export class ArenaModule {}
