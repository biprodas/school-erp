import { IsOptional, IsString, IsUUID } from 'class-validator';

export class FilterUserDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  email?: string;

  /** Filter users that have the given role assigned. */
  @IsOptional()
  @IsUUID()
  roleId?: string;
}
