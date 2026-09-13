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

@Module({
  imports: [ConfigModule.forRoot({isGlobal: true}), PrismaModule, AuthModule, UsersModule, MindspacesModule, ConversationsModule, NotesModule, TasksModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
