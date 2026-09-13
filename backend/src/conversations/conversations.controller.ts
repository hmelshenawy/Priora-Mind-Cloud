import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, Query } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { JwtGuard } from 'src/auth/guards/jwt-guard';


@Controller('conversations')
@UseGuards(JwtGuard)
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

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
