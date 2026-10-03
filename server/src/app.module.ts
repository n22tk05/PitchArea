import { Module } from '@nestjs/common';
import { DocumentModule } from './document/document.module';
import { ArenaModule } from './websocket/arena.module';

@Module({
  imports: [DocumentModule, ArenaModule],
})
export class AppModule {}
