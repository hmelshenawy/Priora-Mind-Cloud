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
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { NotesService } from './notes.service';

@Controller('notes')
@UseGuards(JwtGuard)
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Post()
  create(
    @Body() dto: CreateNoteDto,
    @Req() req: { user: { userId: string } },
  ) {
    return this.notesService.create(dto, req.user.userId);
  }

  @Get()
  findAll(
    @Query('mindSpaceId', ParseUUIDPipe) mindSpaceId: string,
    @Req() req: { user: { userId: string } },
  ) {
    return this.notesService.findAll(mindSpaceId, req.user.userId);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Req() req: { user: { userId: string } },
  ) {
    return this.notesService.findOne(id, req.user.userId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateNoteDto,
    @Req() req: { user: { userId: string } },
  ) {
    return this.notesService.update(id, dto, req.user.userId);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Req() req: { user: { userId: string } },
  ) {
    return this.notesService.remove(id, req.user.userId);
  }
}
