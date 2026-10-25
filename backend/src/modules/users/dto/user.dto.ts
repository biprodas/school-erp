import { Expose } from 'class-transformer';
import { PlatformRole } from '../enums/platform-role.enum';
import { UserStatus } from '../enums/user-status.enum';

export class UserDto {
  @Expose()
  id: string;

  @Expose()
  email: string;

  @Expose()
  status: UserStatus;

  /** Platform tokens only; check it with `platformCan`. */
  @Expose()
  platformRole?: PlatformRole;
}
