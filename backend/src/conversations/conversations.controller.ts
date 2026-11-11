import { Controller, Get, Post, Res, Body, Patch, Param, Delete, UseGuards, Req, Query, ParseUUIDPipe } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { ConversationMessagesService } from './conversation-messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { ResumeHitlDto } from './dto/resume-hitl.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { JwtGuard } from 'src/auth/guards/jwt-guard';
import type { Response } from 'express';


@Controller('conversations')
@UseGuards(JwtGuard)
export class ConversationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly conversationMessagesService: ConversationMessagesService,
  ) { }

  @Post(':id/messages')
  async createMessage(
    @Param('id') conversationId: string,
    @Body() dto: CreateMessageDto,
    @Req() req: { user: { userId: string }, headers: { authorization: string } },
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');

    const stream = this.conversationMessagesService.create(
      conversationId,
      dto,
      req.user.userId,
      req.headers.authorization,
    );

    for await (const chunk of stream) {
      res.write(chunk);
    }

    res.end();
  }

  @Post(':id/hitl')
  async resumeHITL(
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Body() dto: ResumeHitlDto,
    @Req() req: { user: { userId: string }, headers: { authorization: string } },
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    try {
      for await (const chunk of this.conversationMessagesService.resume(
        conversationId, dto, req.user.userId, req.headers.authorization,
      )) {
        res.write(chunk);
      }
    } catch (error) {
      if (!res.headersSent) throw error;
      res.write(JSON.stringify({ type: 'error', content: {
        code: 'HITL_RESUME_FAILED', message: 'The decision could not be completed. Please try again.',
      } }) + '\n');
    }
    res.end();
  }

  @Get(':id/messages')
  findMessages(
    @Param('id') conversationId: string,
    @Req() req: { user: { userId: string } },
  ) {
    return this.conversationMessagesService.findAll(conversationId, req.user.userId);
  }

  @Post()
  create(@Body() createConversationDto: CreateConversationDto, @Req() req: any) {
    const userId = req.user.userId
    return this.conversationsService.create(createConversationDto, userId);
  }

  @Get()
  findAll(@Query() query: any, @Req() req: any) {
    const mindSpaceId = query.mindSpaceId
    const userId = req.user.userId
    return this.conversationsService.findAll(mindSpaceId, userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    const userId = req.user.userId
    return this.conversationsService.findOne(id, userId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateConversationDto: UpdateConversationDto, @Req() req: any) {
    const userId = req.user.userId
    return this.conversationsService.update(id, updateConversationDto, userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    const userId = req.user.userId
    return this.conversationsService.remove(id, userId);
  }
}
