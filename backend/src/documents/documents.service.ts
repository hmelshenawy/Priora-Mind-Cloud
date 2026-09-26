import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { StorageService } from './storage.service';
import { randomUUID } from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import { RagService } from './rag.service';
import { error } from 'console';

@Injectable()
export class DocumentsService {
    constructor(
        private readonly storage: StorageService,
        private readonly prisma: PrismaService,
        private readonly rag: RagService,
    ) { }

    async upload(file: Express.Multer.File, mindSpaceId: string, userId: string) {
        const isPdf =
            file.buffer.subarray(0, 5).toString() === '%PDF-';

        if (!isPdf) {
            throw new BadRequestException('Only PDF files are allowed');
        }

        const storageKey = `users/${userId}/mindspaces/${mindSpaceId}/documents/${randomUUID()}.pdf`;

        const existKey = await this.prisma.document.findFirst({where: {storageKey: storageKey, mindSpaceId: mindSpaceId}})
        if(existKey){
            throw new ConflictException("Storage Key already exist!!")
        }

        const mindspace = await this.prisma.mindSpace.findFirst({ where: { id: mindSpaceId, userId: userId } })
        if (!mindspace) {
            throw new NotFoundException("not found!!")
        }

        const result = await this.storage.upload(file, storageKey)

        if (!result) {
            throw new BadRequestException("Upload Failed!!")
        }
        const documentMetaData = await this.prisma.document.create({ data: { fileName: file.originalname, mindSpaceId: mindSpaceId, storageKey: result } })

        if (!documentMetaData) {
            throw new BadRequestException("Failed to add row to database!!")
        }

        try {
            const rag = await this.rag.ingest(storageKey, documentMetaData.id, mindSpaceId)
            const updatedMetaData = await this.prisma.document.update({
                where: { id: documentMetaData.id, },
                data: { status: 'READY' },
            })
            return {
                result,
                documentMetaData: updatedMetaData,
                rag,
            };
        } catch (error) {
            console.error('RAG ingestion failed', error);
            await this.prisma.document.update({
                where: { id: documentMetaData.id, },
                data: { status: 'FAILED' },
            });
            throw new BadRequestException("RAG failed!!")
        }
    }

    async getAll(userId, mindSpaceId) {

        const docs = await this.prisma.document.findMany({ where: { mindSpaceId: mindSpaceId, mindSpace: { userId: userId } }, orderBy: { createdAt: "desc" } })
        return docs
    }

    async remove(id: string, userId: string) {
        const document = await this.prisma.document.findFirst({ where: { id: id, mindSpace: { userId: userId } } })
        if (!document) {
            throw new NotFoundException("docu not found!!")
        }

        const result = await this.storage.delete(document.storageKey)
        if (result.error) {
            throw new BadRequestException("Failed To delete!!")
        }
        return await this.prisma.document.delete({ where: { id: id } })
    }
}
