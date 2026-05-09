import { Expose } from 'class-transformer'
import { PlatformRole } from '../enums/platform-role.enum'
import { UserStatus } from '../enums/user-status.enum'

export class UserDto {
  @Expose()
  id: string

  @Expose()
  email: string

  @Expose()
  role: PlatformRole

  @Expose()
  status: UserStatus
}