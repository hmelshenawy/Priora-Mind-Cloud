import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsISO8601,
} from 'class-validator';

export class EventMemoryDto {
  @IsString()
  summary!: string;

  @IsOptional()
  @IsISO8601()
  occurredAt?: string;

  @IsArray()
  entities!: unknown[];

  @IsArray()
  participants!: unknown[];

  @IsArray()
  concepts!: unknown[];

  @IsNumber()
  salience!: number;

  @IsArray()
  @ArrayMinSize(1024)
  @ArrayMaxSize(1024)
  @IsNumber({}, { each: true })
  embedding!: number[];
}