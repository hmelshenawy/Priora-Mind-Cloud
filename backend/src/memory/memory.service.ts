import { BadRequestException, ConflictException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateMemoryDto } from './dto/create-memory.dto';
import { UpdateMemoryDto } from './dto/update-memory.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { randomUUID } from 'crypto';

@Injectable()
export class MemoryService {
  constructor(
    private readonly prisma: PrismaService,
  ) { }


  async create(dto: CreateMemoryDto, userId: string, mindSpaceId: string) {
    const mindSpace = await this.prisma.mindSpace.findFirst({ where: { id: mindSpaceId, userId: userId } })
    if (!mindSpace) {
      throw new NotFoundException("MindSpace Not Found!!")
    }
    const isExist = await this.prisma.memory.findFirst({ where: { userId: userId, mindSpaceId: mindSpaceId, content: dto.content } })
    if (isExist) {
      throw new ConflictException("Memory Already Exist")
    }
    const memory = await this.insertMemory(dto, userId, mindSpaceId)

    return {
      success: true,
      data: memory
    };
  }

  async search(dto, userId: string, mindSpaceId: string) {

    // validation / business logic هنا
    console.log(userId)
    console.log(dto)
    console.log(mindSpaceId)
    return this.searchSimilarMemories(
      dto.embedding,
      userId,
      mindSpaceId
    );
  }


  // sql query to creat new memory
  private async insertMemory(
    dto: CreateMemoryDto,
    userId: string,
    mindSpaceId: string
  ) {
    const id = randomUUID();
    const embedding = `[${dto.embedding.join(',')}]`;

    const result = await this.prisma.$queryRaw<any[]>`
    INSERT INTO "Memory"
    (
      "id",
      "userId",
      "mindSpaceId",
      "type",
      "content",
      "confidence",
      "embedding",
      "createdAt",
      "updatedAt"
    )
    VALUES
    (
      ${id},
      ${userId},
      ${mindSpaceId},
      ${dto.type}::"MemoryType",
      ${dto.content},
      ${dto.confidence ?? null},
      ${embedding}::vector,
      NOW(),
      NOW()
    )
    RETURNING
      "id",
      "userId",
      "mindSpaceId",
      "type",
      "content",
      "confidence",
      "createdAt",
      "updatedAt"
  `;

    return result[0];
  }

  // sql query saved memories
  private async searchSimilarMemories(
    embedding: number[],
    userId: string,
    mindSpaceId: string,
    limit = 5,
    threshold = 0.6,
  ) {
    const vector = `[${embedding.join(',')}]`;

    return this.prisma.$queryRaw<any[]>`
    SELECT
      "id",
      "type",
      "content",
      "confidence",
      1 - ("embedding" <=> ${vector}::vector) AS "similarity"
    FROM "Memory"
    WHERE "userId" = ${userId}
      AND "mindSpaceId" = ${mindSpaceId}
      AND 1 - ("embedding" <=> ${vector}::vector) >= ${threshold}
    ORDER BY "embedding" <=> ${vector}::vector
    LIMIT ${limit}
  `;
  }
}
