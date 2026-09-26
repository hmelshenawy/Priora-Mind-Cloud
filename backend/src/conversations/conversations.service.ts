import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { PrismaService } from 'src/prisma/prisma.service';


@Injectable()
export class ConversationsService {
  constructor(
    private readonly primsa: PrismaService
  ) { }
  async create(createConversationDto: CreateConversationDto, userId: string) {
    const minspaceId = createConversationDto.mindSpaceId.trim()
    const mindSpace = await this.primsa.mindSpace.findFirst({ where: { id: minspaceId, userId: userId } })
    if (!mindSpace) {
      throw new NotFoundException("mindSpace not found!!")
    }

    const conversation = await this.primsa.conversation.create({ data: { title: createConversationDto.title, mindSpaceId: minspaceId } })
    return conversation;
  }

  async findAll(mindSpaceId: string, userId: string) {
    const ok = await this.primsa.mindSpace.findFirst({ where: { id: mindSpaceId, userId: userId } })
    if (!ok) {
      throw new NotFoundException("mindspace not found!!")
    }
    const conversations = await this.primsa.conversation.findMany({ where:  { mindSpaceId: mindSpaceId , mindSpace: {userId: userId} } , orderBy: { updatedAt: "desc" } })
    return conversations;
  }

  async findOne(id: string, userId: string) {
    const conversation = await this.primsa.conversation.findFirst({ where: { id: id, mindSpace: { userId: userId } } })

    if (!conversation) {
      throw new NotFoundException("Conversation not found!!")
    }


    return conversation;
  }

  async update(conversationId: string, updateConversationDto: UpdateConversationDto, userId: string) {
    const title = updateConversationDto.title?.trim()
    const conversation = await this.primsa.conversation.findFirst({where: {id: conversationId, mindSpace: {userId: userId}}})
    if(!conversation){
      throw new NotFoundException("not found Conversation!!")
    }
    const updatedCoversation = await this.primsa.conversation.update({where: {id: conversationId}, data:{title: title}})
    return updatedCoversation;
  }

 async remove(id: string, userId: string) {
  const conversation = await this.primsa.conversation.findFirst({where: {id: id, mindSpace:{userId: userId}}})
  if(!conversation){
    throw new NotFoundException("not found!!")
  }

  await this.primsa.conversation.delete({where:{id: id}})
   
    return `This action removes a #${id} conversation`;
  }
}
