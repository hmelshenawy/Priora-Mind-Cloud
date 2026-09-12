import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { CreateAuthDto } from './dto/create-auth.dto';
import { LoginDto } from './dto/login-auth.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import argon2 from 'argon2';

import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService
  ) { }

  async register(createAuthDto: CreateAuthDto) {
    const email = createAuthDto.email.trim().toLowerCase()

    const isExist = await this.prisma.user.findUnique({ where: { email: email } })
    if (isExist) {
      throw new ConflictException("Email already found!!")
    }

    const passwordHash = await argon2.hash(createAuthDto.password)

    const user = await this.prisma.user.create({ "data": { email: email, passwordHash: passwordHash } })
    return {
      "email": user.email,
      "id": user.id,
      "createdAt": user.createdAt,
    };
  }

  async login(loginDto: LoginDto) {
    const email = loginDto.email.trim().toLowerCase()
    const user = await this.prisma.user.findUnique({ where: { email: email } })
    if (!user) {
      throw new UnauthorizedException('Invalid email or password!!');
    }


    const isPasswordValid = await argon2.verify(
      user.passwordHash,
      loginDto.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password!!');
    }

    const payload = {
      "sub": user.id,
      "email": user.email
    }
    const accessToken = await this.jwtService.signAsync(payload)
    return {
      user: {
        id: user.id,
        email: user.email,
      },
      accessToken,
    };
  }
}
