
import { IsNotEmpty, IsString } from "class-validator"

export class CreateMindspaceDto {

    @IsString()
    @IsNotEmpty()
    name!: string
}
