import { Module } from '@nestjs/common';
import { UserSkillsService } from './user-skills.service';
import { UserSkillsController } from './user-skills.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports:[PrismaModule],
  controllers: [UserSkillsController],
  providers: [UserSkillsService],
})
export class UserSkillsModule {}
