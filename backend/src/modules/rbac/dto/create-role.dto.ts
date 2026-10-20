import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { RoleScope } from '../enums/role-scope.enum';

export class CreateRoleDto {
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  /** Permission keys from the catalog; validated against it in the service. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];

  /** Defaults to `school`; `assigned` limits the role to taught sections. */
  @IsOptional()
  @IsEnum(RoleScope)
  scope?: RoleScope;
}
