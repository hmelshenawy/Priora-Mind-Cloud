import { PartialType } from '@nestjs/mapped-types';
import { CreateMindspaceDto } from './create-mindspace.dto';

export class UpdateMindspaceDto extends PartialType(CreateMindspaceDto) {}
