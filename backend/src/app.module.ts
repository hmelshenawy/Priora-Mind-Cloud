import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MindspacesModule } from './mindspaces/mindspaces.module';
import { ConversationsModule } from './conversations/conversations.module';
import { NotesModule } from './notes/notes.module';
import { TasksModule } from './tasks/tasks.module';
import { DocumentsModule } from './documents/documents.module';
import { AgentModule } from './agent/agent.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { APP_GUARD } from '@nestjs/core';
import { MemoryModule } from './memory/memory.module';

@Module({
  imports: [ConfigModule.forRoot({isGlobal: true}), PrismaModule, AuthModule, UsersModule, MindspacesModule, ConversationsModule, NotesModule, TasksModule, DocumentsModule, AgentModule,
    ThrottlerModule.forRoot({
      throttlers:[{ttl: 60000,
        limit:100,
      }]
    }),
    MemoryModule
  ],
  controllers: [AppController],
  providers: [AppService, {
    provide: APP_GUARD,
    useClass: ThrottlerGuard,
  }, ],
})
export class AppModule {}
