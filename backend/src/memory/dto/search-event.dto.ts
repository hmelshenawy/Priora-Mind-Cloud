import { IsArray, ArrayMinSize, ArrayMaxSize, IsNumber} from "class-validator"

export class SearchEventDto {
    @IsArray()
    @ArrayMinSize(1024)
    @ArrayMaxSize(1024)
    @IsNumber({}, { each: true })
    embedding!: number[];

}