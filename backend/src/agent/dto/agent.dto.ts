import {IsString, IsNotEmpty} from "class-validator"

export type ConversationHistoryItem = {
  role: string;
  content: string;
};

export class RunAgentDto {

    @IsString()
    @IsNotEmpty()
    message!: string;

    @IsNotEmpty()
    history!: ConversationHistoryItem[];

    @IsString()
    @IsNotEmpty()
    accessToken!: string

    @IsNotEmpty()
    @IsString()
    mindSpaceId!: string

}
