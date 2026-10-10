import { Controller, Post, Body, Req, Headers, UseGuards } from '@nestjs/common';
import { MemoryService } from './memory.service';
import { CreateMemoryDto } from './dto/create-memory.dto';
import { JwtGuard } from 'src/auth/guards/jwt-guard';
import { SearchMemoryDto } from './dto/search-memory.dto';
import { EventMemoryDto } from './dto/create_event.dto';
import { EventMemoryService } from './event.service';
import { SearchEventDto } from './dto/search-event.dto';

@Controller('memory')
@UseGuards(JwtGuard)
export class MemoryController {
  constructor(
    private readonly memoryService: MemoryService,
    private readonly eventService: EventMemoryService,
  ) { }

  @Post()
  create(
    @Body() createMemoryDto: CreateMemoryDto,
    @Req() req: any,
    @Headers('x-mindspace-id') mindSpaceId: string,

  ) {
    const userId = req.user.userId
    console.log("meomory control hit:D ")
    return this.memoryService.create(createMemoryDto, userId, mindSpaceId);
  }

  @Post('search')
  search(
    @Body() dto: SearchMemoryDto,
    @Req() req,
    @Headers('x-mindspace-id') mindSpaceId: string,
  ) {
    return this.memoryService.search(dto, req.user.userId, mindSpaceId);
  }

  // ---------------------------------------------
  //  Event Memory Handling
  @Post("/event")
  createEvent(
    @Body() dto: EventMemoryDto,
    @Req() req: any,
    @Headers('x-mindspace-id') mindSpaceId: string,

  ) {
    const userId = req.user.userId
    return this.eventService.createEvent(dto, userId, mindSpaceId);
  }

  @Post("/event/search")
  searchEvent(
    @Body() dto: SearchEventDto,
    @Req() req: any,
    @Headers('x-mindspace-id') mindSpaceId: string,
  ){
      const userId = req.user.userId
      return this.eventService.search(dto, userId, mindSpaceId)
  }
}
