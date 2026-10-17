import { Expose } from 'class-transformer';
import { UserStatus } from '../enums/user-status.enum';

export class UserDto {
  @Expose()
  id: string;

  @Expose()
  email: string;

  @Expose()
  status: UserStatus;

  @Expose()
  isAdmin: boolean;
}
