import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { min } from 'rxjs';

@Injectable()
export class NotesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateNoteDto, userId: string) {
    const mindSpace = await this.prisma.mindSpace.findFirst({
      where: { id: dto.mindSpaceId, userId },
    });
    if (!mindSpace) {
      throw new NotFoundException('MindSpace not found');
    }

    const exist = await this.isExisting(dto)
    if(exist){
      return exist.data
    }

    return this.prisma.note.create({
      data: {
        mindSpaceId: dto.mindSpaceId,
        title: dto.title.trim(),
        content: dto.content.trim(),
      },
    });
  }

  async findAll(mindSpaceId: string, userId: string) {
    const mindSpace = await this.prisma.mindSpace.findFirst({
      where: { id: mindSpaceId, userId },
    });
    if (!mindSpace) {
      throw new NotFoundException('MindSpace not found');
    }

    return this.prisma.note.findMany({
      where: { mindSpaceId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const note = await this.prisma.note.findFirst({
      where: { id, mindSpace: { userId } },
    });
    if (!note) {
      throw new NotFoundException('Note not found');
    }
    return note;
  }

  async update(id: string, dto: UpdateNoteDto, userId: string) {
    await this.findOne(id, userId);

    return this.prisma.note.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        content: dto.content?.trim(),
      },
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);

    return this.prisma.note.delete({ where: { id } });
  }

  async isExisting(dto: CreateNoteDto){
    const title = dto.title.trim()
    const content = dto.content.trim()
    const mindSpaceId = dto.mindSpaceId
    const dupWindow = new Date(Date.now() - 2 * 60 * 1000)

    const exist = await this.prisma.note.findFirst({ where: {mindSpaceId: mindSpaceId, title: title, content: content, createdAt: {gte: dupWindow}}})

    if(exist){
      return {
        status: true,
        data: exist
      }
    }
    return
  }
}
