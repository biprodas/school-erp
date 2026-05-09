import { IsString, IsOptional, Length, IsEnum, IsFQDN } from 'class-validator';
import { TenantStatus } from '../enums/tenant-status.enum';

export class UpdateTenantDto {
  @IsString()
  @Length(3, 100)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(3, 63)
  @IsFQDN({
    require_tld: true,
    allow_underscores: false,
  })
  domain?: string;

  @IsOptional()
  @IsEnum(TenantStatus)
  status?: TenantStatus;
}
