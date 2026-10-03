import { Module } from '@nestjs/common';
import { ArenaGateway } from './arena.gateway';

@Module({
  providers: [ArenaGateway],
  exports: [ArenaGateway],
})
export class ArenaModule {}
