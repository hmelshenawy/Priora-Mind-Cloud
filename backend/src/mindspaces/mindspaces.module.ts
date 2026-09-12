import { Module } from '@nestjs/common';
import { MindspacesService } from './mindspaces.service';
import { MindspacesController } from './mindspaces.controller';
import { JwtGuard } from 'src/auth/guards/jwt-guard';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports:[PrismaModule, AuthModule],
  controllers: [MindspacesController],
  providers: [MindspacesService],
})
export class MindspacesModule {}
