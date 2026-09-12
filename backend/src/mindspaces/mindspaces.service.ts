import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateMindspaceDto } from './dto/create-mindspace.dto';
import { UpdateMindspaceDto } from './dto/update-mindspace.dto';
import { PrismaService } from 'src/prisma/prisma.service';


@Injectable()
export class MindspacesService {
  constructor(
    private readonly prisma: PrismaService
  ) { }
  async create(createMindspaceDto: CreateMindspaceDto, userId: string) {

    const name = createMindspaceDto.name.trim().toLowerCase()
    const isExist = await this.prisma.mindSpace.findFirst({ where: { name: name, userId: userId } })
    if (isExist) {
      throw new ConflictException("Mind Space Already Exists!!")
    }
    const mindSpace = await this.prisma.mindSpace.create({ "data": { name: name, userId: userId } })

    return mindSpace;
  }

  async findAll(userid: string) {
    const mindSpaces = await this.prisma.mindSpace.findMany({ where: { userId: userid }, include: { user: { select: { id: true, email: true } } } })
    return {
      count: mindSpaces.length,
      result: mindSpaces,

    };
  }

  async findOne(id: string, userId: string) {
    const mindSpace = await this.prisma.mindSpace.findFirst({ where: { id: id, userId: userId } })
    if (!mindSpace) {
      throw new NotFoundException('Mind Space Not Found!!');
    }
    return mindSpace;
  }

  async update(id: string, updateMindspaceDto: UpdateMindspaceDto, userId: string) {
    const isExist = await this.prisma.mindSpace.findFirst({ where: { id: id, userId: userId } })
    if (!isExist) {
      throw new NotFoundException("Mind Space not found!!")
    }
    const name = updateMindspaceDto.name?.trim().toLowerCase()

    const dup = await this.prisma.mindSpace.findFirst({ where: { name: name, userId: userId } })
    if (dup) {
      throw new ConflictException("Name Already Found!!")
    }
    const mindspace = await this.prisma.mindSpace.update({ where: { id: id }, data: { name: name } })
    return mindspace;
  }

  async remove(id: string, userId: string) {
    const mindspace = await this.prisma.mindSpace.findFirst({where:{id: id, userId: userId}})
    if(!mindspace){
      throw new NotFoundException("not found !!")
    }
    await this.prisma.mindSpace.delete({where:{id: id , userId: userId}})
    return `This action removes a #${id} mindspace`;
  }
}
