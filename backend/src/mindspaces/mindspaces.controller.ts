import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { MindspacesService } from './mindspaces.service';
import { CreateMindspaceDto } from './dto/create-mindspace.dto';
import { UpdateMindspaceDto } from './dto/update-mindspace.dto';
import { JwtGuard } from 'src/auth/guards/jwt-guard';

@Controller('mindspaces')
@UseGuards(JwtGuard)
export class MindspacesController {
  constructor(private readonly mindspacesService: MindspacesService) {}

  @Post()
  create(@Body() createMindspaceDto: CreateMindspaceDto, @Req() req: any) {
    const userId = req.user.userId
    return this.mindspacesService.create(createMindspaceDto, userId);
  }

  @Get()
  findAll(@Req() req: any) {
    const userId = req.user.userId
    return this.mindspacesService.findAll(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    const userId = req.user.userId
    return this.mindspacesService.findOne(id, userId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateMindspaceDto: UpdateMindspaceDto, @Req() req: any) {
    const userId = req.user.userId
    return this.mindspacesService.update(id, updateMindspaceDto, userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    const userId = req.user.userId
    return this.mindspacesService.remove(id, userId);
  }
}
