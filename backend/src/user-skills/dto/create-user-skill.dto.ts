import { IsNotEmpty, IsString, MaxLength, Matches } from "class-validator"

export class CreateUserSkillDto {

@IsNotEmpty()
@Matches(/\S/)
@IsString()
@MaxLength(100)
name!: string;

@IsNotEmpty()
@Matches(/\S/)
@IsString()
@MaxLength(500)
description !: string;

@IsNotEmpty()
@Matches(/\S/)
@IsString()
@MaxLength(5000)
instructions!: string;

}
