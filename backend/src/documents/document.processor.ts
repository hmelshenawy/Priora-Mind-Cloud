import { randomUUID } from "node:crypto";
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from 'src/prisma/prisma.service';
import { RagService } from './rag.service';

@Injectable()
@Processor('document-processing')
export class DocumentProcessor extends WorkerHost {
  private readonly logger = new Logger(DocumentProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rag: RagService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== 'process-document') {
      throw new Error(`Unknown job: ${job.name}`);
    }

    const { documentId, storageKey, mindSpaceId, fileName } = job.data;

    const requestId = randomUUID();
    this.logger.debug(`request_id=${requestId} document.processing.started`);

    try {
      await this.prisma.document.update({
        where: { id: documentId },
        data: { status: 'PROCESSING' },
      });

      this.logger.debug(`request_id=${requestId} document.ingest.started`);

      await this.rag.ingest(storageKey, documentId, mindSpaceId, fileName, requestId);

      await this.prisma.document.update({
        where: { id: documentId },
        data: { status: 'READY' },
      });

      this.logger.log(`request_id=${requestId} document.processing.completed`);
    } catch (error) {
      this.logger.error(`request_id=${requestId} document.processing.failed error_code=document_processing_failed`);

      if (job.attemptsMade + 1 >= (job.opts.attempts ?? 1)) {
        await this.prisma.document.update({
          where: { id: documentId },
          data: { status: 'FAILED' },
        });
      }

      throw error;
    }
  }
}