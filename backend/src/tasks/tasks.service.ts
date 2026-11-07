import { requestContext } from '../logging/request-logging';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTaskDto, userId: string) {
    const mindSpace = await this.prisma.mindSpace.findFirst({
      where: { id: dto.mindSpaceId, userId },
    });
    if (!mindSpace) {
      throw new NotFoundException('MindSpace not found');
    }

    const exist = await this.isExist(dto)
    if(exist){
      const context = requestContext.getStore();
      if (context) context.counts = { saved_count: 0 };
      return exist
    }

    const result = await this.prisma.task.create({
      data: {
        mindSpaceId: dto.mindSpaceId,
        title: dto.title.trim(),
        description: dto.description?.trim() ?? null,
        executor: dto.executor,
      },
    });
    const context = requestContext.getStore();
    if (context) context.counts = { saved_count: 1 };
    return result;
  }

  async findAll(mindSpaceId: string, userId: string) {
    const mindSpace = await this.prisma.mindSpace.findFirst({
      where: { id: mindSpaceId, userId },
    });
    if (!mindSpace) {
      throw new NotFoundException('MindSpace not found');
    }

    const result = await this.prisma.task.findMany({
      where: { mindSpaceId },
      orderBy: { updatedAt: 'desc' },
    });
    const context = requestContext.getStore();
    if (context) context.counts = { result_count: result.length };
    return result;
  }

  async findOne(id: string, userId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, mindSpace: { userId } },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }

  async update(id: string, dto: UpdateTaskDto, userId: string) {
    await this.findOne(id, userId);

    const result = await this.prisma.task.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        description: dto.description?.trim(),
        status: dto.status,
        executor: dto.executor,
      },
    });
    const context = requestContext.getStore();
    if (context) context.counts = { saved_count: 1 };
    return result;
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);

    const result = await this.prisma.task.delete({ where: { id } });
    const context = requestContext.getStore();
    if (context) context.counts = { saved_count: 1 };
    return result;
  }

  async isExist(dto: CreateTaskDto){
    const description = dto.description?.trim() ?? null
    const title = dto.title.trim()
    const mindSpaceId = dto.mindSpaceId
    const executor = dto.executor
    const dupWindow = new Date(Date.now()- 2 * 60 * 1000 )

    const exist = await this.prisma.task.findFirst({where: {title: title, description: description, mindSpaceId, executor:executor, createdAt:{gte: dupWindow }}})
    if(exist){
      return exist
    }
  }
}

