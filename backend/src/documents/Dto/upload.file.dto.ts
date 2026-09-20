import { IsNotEmpty, IsUUID } from "class-validator"

export class UploadFileDto{

    @IsUUID()
    @IsNotEmpty()
    mindSpaceId!: string
}