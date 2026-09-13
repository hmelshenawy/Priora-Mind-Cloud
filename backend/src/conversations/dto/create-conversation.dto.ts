import {IsString, IsNotEmpty, IsUUID, MinLength} from "class-validator"

export class CreateConversationDto {

    @IsString()
    @IsNotEmpty()
    @MinLength(3)
    title!: string;

    @IsUUID()
    mindSpaceId!: string;
}
