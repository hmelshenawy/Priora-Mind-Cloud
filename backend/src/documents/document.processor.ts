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

    const { documentId, storageKey, mindSpaceId } = job.data;

    this.logger.log(`Processing document: ${documentId}`);

    try {
      await this.prisma.document.update({
        where: { id: documentId },
        data: { status: 'PROCESSING' },
      });

      this.logger.log(`Calling RAG for document: ${documentId}`);

      await this.rag.ingest(storageKey, documentId, mindSpaceId);

      await this.prisma.document.update({
        where: { id: documentId },
        data: { status: 'READY' },
      });

      this.logger.log(`Document READY: ${documentId}`);
    } catch (error) {
      this.logger.error(`Document processing failed: ${documentId}`, error);

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