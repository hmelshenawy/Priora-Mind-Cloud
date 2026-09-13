import { IsEnum, IsNotEmpty, IsString, IsUUID, ValidateIf } from 'class-validator';
import { Executor } from '../../../generated/prisma/enums';

export class CreateTaskDto {
  @IsUUID()
  mindSpaceId!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  description?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(Executor)
  executor?: Executor;
}
