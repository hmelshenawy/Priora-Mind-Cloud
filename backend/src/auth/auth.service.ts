import { ConflictException, Injectable } from '@nestjs/common';
import { CreateAuthDto } from './dto/create-auth.dto';
import { UpdateAuthDto } from './dto/update-auth.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import argon2 from 'argon2';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
  ) { }

  async register(createAuthDto: CreateAuthDto) {
    const isExist = await this.prisma.user.findUnique({ where: { email: createAuthDto.email } })
    if (isExist) {
      throw new ConflictException("Email already found!!")
    }

    const passwordHash = await argon2.hash(createAuthDto.password)

    const user = await this.prisma.user.create({"data":{ email: createAuthDto.email, passwordHash: passwordHash}})
    return {"email":user.email,
      "id":user.id,
      "createdAt":user.createdAt,
    };
  }

  findAll() {
    return `This action returns all auth`;
  }

  findOne(id: number) {
    return `This action returns a #${id} auth`;
  }

  update(id: number, updateAuthDto: UpdateAuthDto) {
    return `This action updates a #${id} auth`;
  }

  remove(id: number) {
    return `This action removes a #${id} auth`;
  }
}
