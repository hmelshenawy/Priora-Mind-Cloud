import { IsEnum, IsNotEmpty, IsNumber, IsString, Min, Max, IsArray, ArrayMinSize, ArrayMaxSize } from "class-validator"

import { MemoryType } from '../../../generated/prisma/enums';

export class CreateMemoryDto {

    @IsEnum(MemoryType)
    type!: MemoryType;

    @IsString()
    @IsNotEmpty()
    content!: string;

    @IsNumber()
    @Min(0)
    @Max(1)
    confidence?: number;

    @IsArray()
    @ArrayMinSize(1024)
    @ArrayMaxSize(1024)
    @IsNumber({}, { each: true })
    embedding!: number[];

}
