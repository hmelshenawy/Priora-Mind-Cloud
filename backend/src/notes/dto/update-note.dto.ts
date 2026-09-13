import { PartialType, PickType } from '@nestjs/mapped-types';
import { CreateNoteDto } from './create-note.dto';

export class UpdateNoteDto extends PartialType(
  PickType(CreateNoteDto, ['title', 'content'] as const),
  { skipNullProperties: false },
) {}
