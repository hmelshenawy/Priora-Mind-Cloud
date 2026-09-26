import { Controller, Post, Get, Req, Param, Body, UseInterceptors, UploadedFile, UseGuards, Delete, Query } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtGuard } from 'src/auth/guards/jwt-guard';
import { UploadFileDto } from './Dto/upload.file.dto';


@Controller('documents')
@UseGuards(JwtGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}


  @Post()
  @UseInterceptors(FileInterceptor("file"))
  uploadFile(@Body() body: UploadFileDto,@UploadedFile() file:Express.Multer.File, @Req() req: any){
    const userId = req.user.userId
    const mindSpaceId = body.mindSpaceId
    console.log(file)
    return this.documentsService.upload(file, mindSpaceId, userId)
  }

  @Get()
  getAll(@Query('mindSpaceId') mindSpaceId: string,@Req() req: any){
    const userId = req.user.userId
    return this.documentsService.getAll(userId, mindSpaceId)
  }


  @Delete(":id")
  remove(@Param("id") id: string, @Req() req: any){
    const userId = req.user.userId
    return this.documentsService.remove(id, userId)

  }
}
