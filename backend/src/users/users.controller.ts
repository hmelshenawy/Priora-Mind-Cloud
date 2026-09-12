import { Controller, Get, Req, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtGuard } from 'src/auth/guards/jwt-guard';


@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

 


}
