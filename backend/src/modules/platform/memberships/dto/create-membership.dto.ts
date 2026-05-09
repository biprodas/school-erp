import { IsEnum, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { MembershipRole } from '../enums/membership-role.enum';

export class CreateMembershipDto {
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @IsUUID()
  @IsNotEmpty()
  tenantId: string;

  @IsOptional()
  @IsEnum(MembershipRole)
  role?: MembershipRole;
}
