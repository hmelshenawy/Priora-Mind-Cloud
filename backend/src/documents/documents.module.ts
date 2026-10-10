import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { StorageService } from './storage.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { RagService } from './rag.service';
import { BullModule } from '@nestjs/bullmq';
import { DocumentProcessor } from './document.processor';

@Module({
  imports:[PrismaModule, BullModule.registerQueue({
    name: 'document-processing',
  })],
  controllers: [DocumentsController],
  providers: [DocumentsService, StorageService, RagService,DocumentProcessor],
})
export class DocumentsModule {}
