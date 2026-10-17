import { IsEnum, IsNotEmpty } from 'class-validator';
import { MembershipRole } from '../enums/membership-role.enum';

export class UpdateMembershipRoleDto {
  @IsEnum(MembershipRole)
  @IsNotEmpty()
  role: MembershipRole;
}
