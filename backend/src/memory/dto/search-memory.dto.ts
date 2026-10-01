import { IsArray, ArrayMinSize, ArrayMaxSize, IsNumber} from "class-validator"

export class SearchMemoryDto {
    @IsArray()
    @ArrayMinSize(1024)
    @ArrayMaxSize(1024)
    @IsNumber({}, { each: true })
    embedding!: number[];

}