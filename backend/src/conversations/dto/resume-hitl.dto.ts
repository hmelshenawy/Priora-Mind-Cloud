import { IsIn, IsUUID } from 'class-validator';

export class ResumeHitlDto {
  @IsUUID()
  executionId!: string;

  @IsIn(['approve', 'reject'])
  decision!: 'approve' | 'reject';
}
