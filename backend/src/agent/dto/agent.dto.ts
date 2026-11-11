import {IsString, IsNotEmpty, IsOptional, IsIn, IsUUID} from "class-validator"

export type ConversationHistoryItem = {
  role: string;
  content: string;
};

export class RunAgentDto {

    @IsIn(['message', 'HITL'])
    type!: 'message' | 'HITL';

    @IsUUID()
    executionId!: string;

    @IsOptional()
    @IsIn(['approve', 'reject'])
    decision?: 'approve' | 'reject';

    @IsOptional()
    @IsString()
    @IsNotEmpty()
    message?: string;

    @IsNotEmpty()
    history!: ConversationHistoryItem[];

    @IsString()
    @IsNotEmpty()
    accessToken!: string;

    @IsNotEmpty()
    @IsString()
    mindSpaceId!: string;

    @IsNotEmpty()
    @IsString()
    sourceMessageId!: string;

}
