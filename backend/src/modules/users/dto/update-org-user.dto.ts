import { IsEnum, IsOptional, IsString } from 'class-validator';
import { MembershipStatus } from '~/platform/memberships/enums/membership-status.enum';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(MembershipStatus)
  status?: MembershipStatus;
}
