import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { JwtStrategy } from 'src/auth/strategies/jwt.strategy';
import passport from 'passport';
import { PassportModule } from '@nestjs/passport';

@Module({
  imports:[],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
