import { Controller, Get, Post, Body, Req, Headers, Delete, UseGuards } from '@nestjs/common';
import { MemoryService } from './memory.service';
import { CreateMemoryDto } from './dto/create-memory.dto';
import { JwtGuard } from 'src/auth/guards/jwt-guard';
import { SearchMemoryDto } from './dto/search-memory.dto';

@Controller('memory')
@UseGuards(JwtGuard)
export class MemoryController {
  constructor(private readonly memoryService: MemoryService) { }

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
}
