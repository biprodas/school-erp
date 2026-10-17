import { IsEnum, IsOptional, IsString } from 'class-validator';
import { MembershipStatus } from '~/modules/memberships/enums/membership-status.enum';

export class UpdateOrgUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(MembershipStatus)
  status?: MembershipStatus;
}
