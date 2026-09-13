import { PartialType, PickType } from '@nestjs/mapped-types';
import { IsEnum, ValidateIf } from 'class-validator';
import { TaskStatus } from '../../../generated/prisma/enums';
import { CreateTaskDto } from './create-task.dto';

export class UpdateTaskDto extends PartialType(
  PickType(CreateTaskDto, ['title', 'description', 'executor'] as const),
  { skipNullProperties: false },
) {
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(TaskStatus)
  status?: TaskStatus;
}
