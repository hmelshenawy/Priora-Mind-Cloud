import { event, elapsed, failure, requestContext } from '../logging/request-logging';
import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { randomUUID } from 'crypto';
import { EventMemoryDto } from "./dto/create_event.dto";
import { SearchEventDto } from "./dto/search-event.dto";

type SimilarEvent = {
    id: string;
    similarity: number;
};

@Injectable()
export class EventMemoryService {
  private readonly logger = new Logger(EventMemoryService.name);
    constructor(
        private readonly prisma: PrismaService,
    ) { }
    async createEvent(dto: EventMemoryDto, userId: string, mindSpaceId: string) {
        const mindSpace = await this.prisma.mindSpace.findFirst({ where: { id: mindSpaceId, userId: userId } })
        if (!mindSpace) {
            throw new NotFoundException("MindSpace Not Found!!")
        }

        const isExist = await this.prisma.event.findFirst({ where: { userId: userId, mindSpaceId: mindSpaceId, summary: dto.summary } })
        if (isExist) {
            failure('event_duplicate', 'memory_create', 'warn');
            throw new ConflictException("Event Already Exist")
        }

        const dup_candidates= await this.searchSimilarEvents(dto.embedding, userId, mindSpaceId, 0.8);
        if(dup_candidates.length > 0){
            failure('event_duplicate', 'memory_create', 'warn');
            throw new ConflictException("Similar Event Already Exist")
        }

        const event = await this.insertEvent(dto, userId, mindSpaceId);
        const context = requestContext.getStore();
        if (context) context.counts = { saved_count: 1 };

        return {
            success: true,
            data: event,
        };
    }


    private async insertEvent(
        dto: EventMemoryDto,
        userId: string,
        mindSpaceId: string,
    ) {
        const id = randomUUID();
        const embedding = `[${dto.embedding.join(',')}]`;

        const result = await this.prisma.$queryRaw<any[]>`
    INSERT INTO "Event"
    (
      "id",
      "userId",
      "mindSpaceId",
      "summary",
      "occurredAt",
      "entities",
      "participants",
      "concepts",
      "salience",
      "embedding",
      "createdAt",
      "updatedAt"
    )
    VALUES
    (
      ${id},
      ${userId},
      ${mindSpaceId},
      ${dto.summary},
      ${dto.occurredAt ?? null}::timestamptz,
      ${JSON.stringify(dto.entities)}::jsonb,
      ${JSON.stringify(dto.participants)}::jsonb,
      ${JSON.stringify(dto.concepts)}::jsonb,
      ${dto.salience},
      ${embedding}::vector,
      NOW(),
      NOW()
    )
    RETURNING
      "id",
      "userId",
      "mindSpaceId",
      "summary",
      "occurredAt",
      "entities",
      "participants",
      "concepts",
      "salience",
      "createdAt",
      "updatedAt"
  `;

        return result[0];
    }


    async search(dto: SearchEventDto, userId: string, mindSpaceId: string) {

        const started = performance.now();
        const results = await this.searchSimilarEvents(
            dto.embedding,
            userId,
            mindSpaceId
        );
        const context = requestContext.getStore();
        if (context) context.counts = { result_count: results.length };
        this.logger.debug(event('memory.search.completed', { operation: 'memory.search', status: 'completed', kind: 'event', result_count: results.length, duration_ms: elapsed(started) }));
        return results;
    }



    async searchSimilarEvents(
        embedding: number[],
        userId: string,
        mindSpaceId: string,
        similarityScore: number = 0.4
    ): Promise<SimilarEvent[]> {
        if (embedding.length !== 1024) {
            throw new BadRequestException('Invalid embedding dimensions');
        }

        const vector = `[${embedding.join(',')}]`;

        const events = await this.prisma.$queryRaw<SimilarEvent[]>`
    SELECT
      id,
      summary,
      "occurredAt",
      entities,
      participants,
      concepts,
      salience,
      1 - (embedding <=> ${vector}::vector) AS similarity
    FROM "Event"
    WHERE "userId" = ${userId}
      AND "mindSpaceId" = ${mindSpaceId}
      AND embedding IS NOT NULL
      AND 1 - (embedding <=> ${vector}::vector) >= ${similarityScore}
    ORDER BY embedding <=> ${vector}::vector
    LIMIT 10
  `;

        return events;
    }
}