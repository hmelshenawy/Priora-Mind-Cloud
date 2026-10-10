import { Module } from '@nestjs/common';
import { MemoryService } from './memory.service';
import { MemoryController } from './memory.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { EventMemoryService } from './event.service';

@Module({
  imports:[PrismaModule],
  controllers: [MemoryController],
  providers: [MemoryService, EventMemoryService],
})
export class MemoryModule {}
