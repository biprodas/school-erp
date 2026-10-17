import { IsOptional } from 'class-validator';

export class FilterUserDto {
  @IsOptional()
  id: string;

  @IsOptional()
  name: string;

  @IsOptional()
  email: string;
}
