import { IsOptional, IsString, MaxLength } from "class-validator";

export class FilterCatDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  breed?: string;
}