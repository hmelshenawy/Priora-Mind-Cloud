import { Controller, Req, Get, Post, Query, Body, Patch, Param, Delete, UseGuards, ParseBoolPipe, ParseUUIDPipe } from '@nestjs/common';
import { UserSkillsService } from './user-skills.service';
import { CreateUserSkillDto } from './dto/create-user-skill.dto';
import { UpdateUserSkillDto } from './dto/update-user-skill.dto';
import { JwtGuard } from 'src/auth/guards/jwt-guard';

@UseGuards(JwtGuard)
@Controller('user-skills')
export class UserSkillsController {
  constructor(private readonly userSkillsService: UserSkillsService) { }

  @Post()
  create(@Body() createUserSkillDto: CreateUserSkillDto, @Req() req: any) {
    const userId = req.user.userId
    return this.userSkillsService.create(createUserSkillDto, userId);
  }

  @Get()
  findAll(
    @Req() req: any,
    @Query('enabled', new ParseBoolPipe({ optional: true })) enabled: boolean
  ) {
    const userId = req.user.userId
    return this.userSkillsService.findAll(userId, enabled);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ) {
    return this.userSkillsService.findOne(id, req.user.userId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
    @Body() dto: UpdateUserSkillDto,
  ) {
    return this.userSkillsService.update(
      id,
      req.user.userId,
      dto,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.userSkillsService.remove(+id);
  }
}
