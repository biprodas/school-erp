import { IsOptional, IsString } from 'class-validator';

export class FilterMembershipDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  orgId?: string;
}
