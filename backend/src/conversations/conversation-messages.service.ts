import { event, elapsed, failure, requestContext } from '../logging/request-logging';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { MessageRole } from '../../generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { AgentService } from 'src/agent/agent.service';
import { randomUUID } from 'node:crypto';
import { ResumeHitlDto } from './dto/resume-hitl.dto';

type AgentEvent =
  | { type: 'text'; content: string }
  | { type: 'HITL'; content: Record<string, unknown> }
  | { type: 'error'; content: string | Record<string, unknown> };

// Both Python chat modes return NDJSON; transport chunks are not event boundaries.
async function* readAgentEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<AgentEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  function parse(line: string): AgentEvent {
    const value = JSON.parse(line);
    if (!value || !['text', 'HITL', 'error'].includes(value.type)
      || (value.type === 'text' && typeof value.content !== 'string')
      || (value.type !== 'text' && !(typeof value.content === 'string' && value.type === 'error')
        && (!value.content || typeof value.content !== 'object' || Array.isArray(value.content)))) {
      throw new Error('Invalid Agent stream event');
    }
    return value;
  }
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let newline: number;
      while ((newline = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        if (line.trim()) yield parse(line);
      }
      if (done) break;
    }
    if (buffer.trim()) yield parse(buffer);
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

@Injectable()
export class ConversationMessagesService {
  private readonly logger = new Logger(ConversationMessagesService.name);
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
    const history = await this.prisma.message.findMany({
      where: {
        conversationId,
        conversation: {
          mindSpace: {
            userId,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 48,
    });
    history.reverse()
    const historyList = history.map((message) => ({
      role: message.role.toLowerCase(),
      content: message.content,
    }))
    
    const agentReply = await this.agent.runAgent({
      type: 'message',
      executionId: randomUUID(),
      message: dto.content,
      history: historyList,
      accessToken: accessToken,
      mindSpaceId: mindSpaceId,
      sourceMessageId: sourceMessageId

    })



    let fullReply = ''
    let chunks = 0;
    let status = 'cancelled';
    let stage = 'agent_stream';
    const started = performance.now();
    try {

      for await (const event of readAgentEvents(agentReply)) {
        chunks++;
        if (event.type === 'text') {
          fullReply += event.content;
          yield event.content;
        } else {
          yield JSON.stringify(event) + '\n';
          if (event.type === 'error') {
            status = 'failed';
            failure('agent_stream_failed', stage);
            return;
          }
        }
      }

      stage = 'message_persist';
      await this.prisma.message.createMany({
        data: [{
          conversationId,
          role: MessageRole.USER,
          content: dto.content.trim(),
          createdAt: userCreatedAt
        },
        ...(fullReply.trim() ? [{
          conversationId,
          role: MessageRole.ASSISTANT,
          content: fullReply,
        }] : []),
        ],
      })
      status = 'completed';
      const context = requestContext.getStore();
      if (context) context.counts = { saved_count: fullReply.trim() ? 2 : 1 };
    } catch (error) {
      status = 'failed';
      if (stage === 'agent_stream' && error instanceof DOMException && error.name === 'TimeoutError') {
        failure('agent_timeout', stage, 'warn');
      } else {
        failure(stage === 'message_persist' ? 'message_persist_failed' : 'agent_stream_failed', stage);
      }
      throw error;
    } finally {
      this.logger.debug(event('agent.stream.finished', { operation: 'chat', status: requestContext.getStore()?.cancelled ? 'cancelled' : status, duration_ms: elapsed(started), chunk_count: chunks, output_chars: fullReply.length, error_code: status === 'failed' ? requestContext.getStore()?.failure?.error_code : undefined }));
    }
  }

  async *resume(conversationId: string, dto: ResumeHitlDto, userId: string, auth: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, mindSpace: { userId } },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');

    const body = await this.agent.runAgent({
      type: 'HITL',
      executionId: dto.executionId,
      decision: dto.decision,
      history: [],
      accessToken: auth?.replace(/^Bearer\s+/i, ''),
      mindSpaceId: conversation.mindSpaceId,
      sourceMessageId: '',
    });
    let fullReply = '';
    for await (const event of readAgentEvents(body)) {
      yield JSON.stringify(event) + '\n';
      if (event.type === 'error') {
        // A completed HTTP stream carrying an error is not a successful resume.
        failure('agent_stream_failed', 'agent_stream');
        return;
      }
      if (event.type === 'text') fullReply += event.content;
    }
    if (fullReply.trim()) {
      await this.prisma.message.createMany({ data: [{
        conversationId, role: MessageRole.ASSISTANT, content: fullReply,
      }] });
    }
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
