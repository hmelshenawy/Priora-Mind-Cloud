import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtGuard } from 'src/auth/guards/jwt-guard';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksService } from './tasks.service';

@Controller('tasks')
@UseGuards(JwtGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  create(
    @Body() dto: CreateTaskDto,
    @Req() req: { user: { userId: string } },
  ) {
    return this.tasksService.create(dto, req.user.userId);
  }

  @Get()
  findAll(
    @Query('mindSpaceId', ParseUUIDPipe) mindSpaceId: string,
    @Req() req: { user: { userId: string } },
  ) {
    return this.tasksService.findAll(mindSpaceId, req.user.userId);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: { userId: string } },
  ) {
    return this.tasksService.findOne(id, req.user.userId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
    @Req() req: { user: { userId: string } },
  ) {
    return this.tasksService.update(id, dto, req.user.userId);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: { userId: string } },
  ) {
    return this.tasksService.remove(id, req.user.userId);
  }
}

