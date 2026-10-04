import { Injectable, NotFoundException } from '@nestjs/common';
import { MessageRole } from '../../generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { AgentService } from 'src/agent/agent.service';

@Injectable()
export class ConversationMessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agent: AgentService,
  ) { }

  async *create(conversationId: string, dto: CreateMessageDto, userId: string, auth: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, mindSpace: { userId } },
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const userCreatedAt = new Date();
    const mindSpaceId = conversation.mindSpaceId
    const accessToken = auth?.replace(/^Bearer\s+/i, '');
    const sourceMessageId = ""   // sebo fadi now
    const history = await this.findAll(conversationId, userId)
    const historyList = history.map((message) => ({
      role: message.role.toLowerCase(),
      content: message.content,
    }))

    const agentReply = await this.agent.runAgent({
      message: dto.content,
      history: historyList,
      accessToken: accessToken,
      mindSpaceId: mindSpaceId,
      sourceMessageId: sourceMessageId

    })

    console.log("agnet reply:", agentReply)

    const reader = agentReply.getReader()
    const decoder = new TextDecoder()

    let fullReply = ''

    while (true) {
      const { value, done } = await reader.read()

      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      console.log("NEST CHUNK:", JSON.stringify(chunk))

      fullReply += chunk

      yield chunk
    }

    await this.prisma.message.createMany({
      data: [{
        conversationId,
        role: MessageRole.USER,
        content: dto.content.trim(),
        createdAt: userCreatedAt
      },
      {
        conversationId,
        role: MessageRole.ASSISTANT,
        content: fullReply,
      },
      ],
    })

    
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
