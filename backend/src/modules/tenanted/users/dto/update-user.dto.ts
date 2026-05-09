import { IsEnum, IsString } from 'class-validator';
import { UserStatus } from '../enums/user-status.enum';
import { UserRole } from '../enums/user-role.enum';

export class UpdateUserDto {
  @IsString()
  firstName?: string;

  @IsString()
  lastName?: string;

  @IsEnum(UserRole)
  role?: UserRole;

  @IsEnum(UserStatus)
  status?: UserStatus;
}
