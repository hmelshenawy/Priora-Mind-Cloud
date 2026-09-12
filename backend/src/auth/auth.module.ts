import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [PrismaModule, ConfigModule, JwtModule.registerAsync({
    imports:[ConfigModule],
    inject: [ConfigService],
    useFactory: (config: ConfigService)=> ({
      secret: config.getOrThrow("JWT_SECRET"),
      signOptions: {
        expiresIn: config.getOrThrow("JWT_EXPIRES_IN")
      }
    })
  })
],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule { }
