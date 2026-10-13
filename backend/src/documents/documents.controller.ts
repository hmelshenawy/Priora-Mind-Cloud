import { Controller, Post, Get, Req, Param, Body, UseInterceptors, UploadedFile, UseGuards, Delete, Query, BadRequestException } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtGuard } from 'src/auth/guards/jwt-guard';
import { UploadFileDto } from './Dto/upload.file.dto';
import { StorageService } from './storage.service';
import { randomUUID } from 'crypto';


@Controller('documents')
@UseGuards(JwtGuard)
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly storageService: StorageService,

  ) { }


  @Post()
  @UseInterceptors(FileInterceptor("file"))
  uploadFile(@Body() body: UploadFileDto, @UploadedFile() file: Express.Multer.File, @Req() req: any) {
    const userId = req.user.userId
    const mindSpaceId = body.mindSpaceId
    console.log(file)
    return this.documentsService.upload(file, mindSpaceId, userId)
  }

  @Get()
  getAll(@Query('mindSpaceId') mindSpaceId: string, @Req() req: any) {
    const userId = req.user.userId
    return this.documentsService.getAll(userId, mindSpaceId)
  }


  @Delete(":id")
  remove(@Param("id") id: string, @Req() req: any) {
    const userId = req.user.userId
    return this.documentsService.remove(id, userId)

  }

  @Post('/test-queue')
  async testQueue() {
    return this.documentsService.testQueue();
  }

  @Post("/generated")
  @UseInterceptors(FileInterceptor("file"))
  async uploadGenerated(@Body() body: any, @UploadedFile() file: Express.Multer.File, @Req() req: any) {
    const userId = req.user.userId
    if (
      !file ||
      file.mimetype !== "application/pdf" ||
      file.buffer?.subarray(0, 5).toString() !== "%PDF-"
    ) {
      throw new BadRequestException("Valid PDF file is required");
    }

    const storageKey = `temp/generated/${userId}/${randomUUID()}.pdf`;
    const path = await this.storageService.upload(file, storageKey);

    const downloadUrl = await this.storageService.getSignedUrl(path);

    return {
      filename: file.originalname,
      downloadUrl,
    };
  }

}
