import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, Query } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { ConversationMessagesService } from './conversation-messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { JwtGuard } from 'src/auth/guards/jwt-guard';


@Controller('conversations')
@UseGuards(JwtGuard)
export class ConversationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly conversationMessagesService: ConversationMessagesService,
  ) {}

  @Post(':id/messages')
  createMessage(
    @Param('id') conversationId: string,
    @Body() dto: CreateMessageDto,
    @Req() req: { user: { userId: string }, headers: { authorization: string } },
  ) {
    return this.conversationMessagesService.create(conversationId, dto, req.user.userId, req.headers.authorization);
  }

  @Get(':id/messages')
  findMessages(
    @Param('id') conversationId: string,
    @Req() req: { user: { userId: string } },
  ) {
    return this.conversationMessagesService.findAll(conversationId, req.user.userId);
  }

  @Post()
  create( @Body() createConversationDto: CreateConversationDto, @Req() req: any) {
    const userId = req.user.userId
    return this.conversationsService.create(createConversationDto, userId);
  }

  @Get()
  findAll(@Query() query: any, @Req() req: any) {
    const mindSpaceId = query.minspaceId
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
