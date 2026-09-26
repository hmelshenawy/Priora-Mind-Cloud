import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { StorageService } from './storage.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { RagService } from './rag.service';

@Module({
  imports:[PrismaModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, StorageService, RagService],
})
export class DocumentsModule {}
