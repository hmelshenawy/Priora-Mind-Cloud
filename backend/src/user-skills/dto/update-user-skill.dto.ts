import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateUserSkillDto } from './create-user-skill.dto';

export class UpdateUserSkillDto extends PartialType(CreateUserSkillDto) {
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}