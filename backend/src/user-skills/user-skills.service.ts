import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserSkillDto } from './dto/create-user-skill.dto';
import { UpdateUserSkillDto } from './dto/update-user-skill.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';

@Injectable()
export class UserSkillsService {
  constructor(
    private readonly prisma: PrismaService,
  ) { }
  async create(dto: CreateUserSkillDto, userId: string) {
    const name = dto.name.trim()
    const isExist = await this.prisma.userSkill.findFirst({where:{userId: userId, name: name}})
    if(isExist){
      throw new ConflictException("Skill Already Exist!!")
    }
    
    const skill = await this.prisma.userSkill.create({
      data: {
        userId,
        name: name,
        description: dto.description.trim(),
        instructions: dto.instructions.trim()
      }
    })
    return {
      ok: true,
      data: skill
    };
  }

  async findAll(userId: string, enabled?) {
    const skills = await this.prisma.userSkill.findMany({where:{userId: userId,  ...(enabled !== undefined && { isEnabled: enabled }),}, orderBy:{createdAt:"desc"}})
    
    return {
      ok: true,
      data: skills
    };
  }

  async findOne(id: string, userId: string) {
  const skill = await this.prisma.userSkill.findFirst({
    where: {
      id,
      userId,
    },
  });

  if (!skill) {
    throw new NotFoundException('Skill Not Found!!');
  }

  return {
    ok: true,
    data: skill,
  };
}

 async update(
  id: string,
  userId: string,
  dto: UpdateUserSkillDto,
) {
  // Check ownership
  const skill = await this.prisma.userSkill.findFirst({
    where: { id, userId },
  });

  if (!skill) {
    throw new NotFoundException('Skill Not Found!!');
  }

  try {
    const updatedSkill = await this.prisma.userSkill.update({
      where: { id, userId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && {
          description: dto.description,
        }),
        ...(dto.instructions !== undefined && {
          instructions: dto.instructions,
        }),
        ...(dto.isEnabled !== undefined && {
          isEnabled: dto.isEnabled,
        }),
      },
    });

    return {
      ok: true,
      data: updatedSkill,
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ConflictException('Skill Name Already Exists!!');
      }

      if (error.code === 'P2025') {
        throw new NotFoundException('Skill Not Found!!');
      }
    }

    throw error;
  }
}

  remove(id: number) {
    return `This action removes a #${id} userSkill`;
  }
}
