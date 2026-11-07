import {
  event,
  elapsed,
  failure,
  requestContext,
  resolveRequestId,
  validRequestId,
  RequestState,
} from '../logging/request-logging';
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
    const state: RequestState = {
      requestId: resolveRequestId(job.data.request_id),
    };
    const jobCorrelation = resolveRequestId(job.data.job_correlation_id);
    const started = performance.now();
    const fields = {
      operation: 'ingest',
      job_correlation_id: jobCorrelation,
      attempt: job.attemptsMade + 1,
      max_attempts: job.opts.attempts ?? 1,
    };
    return requestContext.run(state, async () => {
      let stage = 'job_metadata';
      this.logger.debug(
        event('document.processing.started', { ...fields, status: 'started' }),
      );
      try {
        // Persist legacy fallback metadata once so the next attempt reuses it.
        if (
          !validRequestId(job.data.request_id) ||
          !validRequestId(job.data.job_correlation_id)
        ) {
          await job.updateData({
            ...job.data,
            request_id: state.requestId,
            job_correlation_id: jobCorrelation,
          });
        }
        if (job.name !== 'process-document') {
          failure('unknown_job', 'dispatch');
          throw new Error(`Unknown job: ${job.name}`);
        }
        const { documentId, storageKey, mindSpaceId, fileName } = job.data;
        stage = 'processing_status';
        await this.prisma.document.update({
          where: { id: documentId },
          data: { status: 'PROCESSING' },
        });
        stage = 'rag_ingest';
        const ingestStarted = performance.now();
        this.logger.debug(
          event('document.ingest.started', {
            ...fields,
            status: 'started',
            stage,
          }),
        );
        await this.rag.ingest(
          storageKey,
          documentId,
          mindSpaceId,
          fileName,
          state.requestId,
        );
        this.logger.debug(
          event('document.ingest.completed', {
            ...fields,
            status: 'completed',
            stage,
            duration_ms: elapsed(ingestStarted),
          }),
        );
        stage = 'ready_status';
        await this.prisma.document.update({
          where: { id: documentId },
          data: { status: 'READY' },
        });
        this.logger.log(
          event('document.processing.completed', {
            ...fields,
            status: 'completed',
            duration_ms: elapsed(started),
          }),
        );
      } catch (error) {
        failure(
          stage === 'rag_ingest'
            ? 'rag_http_failed'
            : 'document_status_update_failed',
          stage,
        );
        try {
          if (
            job.name === 'process-document' &&
            fields.attempt >= fields.max_attempts
          ) {
            await this.prisma.document.update({
              where: { id: job.data.documentId },
              data: { status: 'FAILED' },
            });
          }
        } finally {
          this.logger[state.failure?.level ?? 'error'](
            event('document.processing.failed', {
              ...fields,
              ...state.failure,
              status: 'failed',
              duration_ms: elapsed(started),
              will_retry: fields.attempt < fields.max_attempts,
            }),
          );
        }
        throw error;
      }
    });
  }
}
