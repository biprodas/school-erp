import { IsEnum, IsOptional } from "class-validator";
import { PlatformRole } from "../enums/platform-role.enum";

export class FilterUserDto {

  @IsOptional()
  id: string;

  @IsOptional()
  firstName: string;

  @IsOptional()
  lastName: string;

  @IsOptional()
  email: string;

  @IsOptional()
  role: PlatformRole;
}