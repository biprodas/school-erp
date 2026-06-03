import { IsOptional, IsString, IsUUID } from 'class-validator';

export class FilterUserDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  email?: string;

  /** Filter users that have the given role assigned. */
  @IsOptional()
  @IsUUID()
  roleId?: string;
}
