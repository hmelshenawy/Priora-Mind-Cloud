import { IsEmail, IsString, IsNotEmpty, MinLength}from "class-validator"
 
export class CreateAuthDto {

    @IsEmail()
    @IsNotEmpty()
    email!: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(5)
    password!: string;

}
