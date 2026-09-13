import { Injectable, NotFoundException } from '@nestjs/common';
import { MessageRole } from '../../generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';

@Injectable()
export class ConversationMessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(conversationId: string, dto: CreateMessageDto, userId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, mindSpace: { userId } },
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return this.prisma.message.create({
      data: {
        conversationId,
        role: MessageRole.USER,
        content: dto.content.trim(),
      },
    });
  }

  async findAll(conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, mindSpace: { userId } },
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
