import { Module } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { ConversationMessagesService } from './conversation-messages.service';
import { ConversationsController } from './conversations.controller';
import { AuthModule } from 'src/auth/auth.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AgentModule } from 'src/agent/agent.module';

@Module({
  imports:[AuthModule, PrismaModule, AgentModule],
  controllers: [ConversationsController],
  providers: [ConversationsService, ConversationMessagesService],
})
export class ConversationsModule {}
