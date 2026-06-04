import { Module } from '@nestjs/common';
import { GreythrController } from './greythr.controller';
import { GreythrService } from './greythr.service';

@Module({
  controllers: [GreythrController],
  providers: [GreythrService],
})
export class GreythrModule {}
