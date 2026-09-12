import { Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from "src/prisma/prisma.service";



@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
    constructor(configService: ConfigService,
        private readonly prisma: PrismaService,
    ) {
        const secret = configService.getOrThrow<string>("JWT_SECRET")
        if (!secret) {
            throw new NotFoundException("JWT not available!!")
        }
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: secret,
        })
    }

    async validate(payload: any) {
        console.log("pyload:", payload)
        const user = await this.prisma.user.findUnique({
    where: { id: payload.sub },
  });

  if (!user) {
    throw new UnauthorizedException();
  }
        return {
            userId: payload.sub,
            email: payload.email,
        }
    }

}