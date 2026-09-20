import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { StorageService } from './storage.service';
import { randomUUID } from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class DocumentsService {
    constructor(
        private readonly storage: StorageService,
        private readonly prisma: PrismaService,
    ) { }

    async upload(file: Express.Multer.File, mindSpaceId: string, userId: string) {
        const isPdf =
            file.buffer.subarray(0, 5).toString() === '%PDF-';

        if (!isPdf) {
            throw new BadRequestException('Only PDF files are allowed');
        }

        const storageKey = `users/${userId}/mindspaces/${mindSpaceId}/documents/${randomUUID()}.pdf`;
        console.log(storageKey)

        const mindspace = await this.prisma.mindSpace.findFirst({ where: { id: mindSpaceId, userId: userId } })
        if (!mindspace) {
            throw new NotFoundException("not found!!")
        }

        const result = await this.storage.upload(file, storageKey)
        const documentMetaData = await this.prisma.document.create({ data: { fileName: file.originalname, mindSpaceId: mindSpaceId, storageKey: result } })

        return { result, documentMetaData }
    }

    async remove(id: string, userId: string){
        const document = await this.prisma.document.findFirst({where:{id: id, mindSpace:{userId: userId}}})
        if(!document){
            throw new NotFoundException("docu not found!!")
        }

        const result = await this.storage.delete(document.storageKey)
        if(result.error){
            throw new BadRequestException("Failed To delete!!")
        }
        return await this.prisma.document.delete({where:{id: id}})
    }
}
