import { IsString, IsOptional, Length, IsEnum, IsFQDN } from 'class-validator';
import { OrganizationStatus } from '../enums/organization-status.enum';

export class UpdateOrganizationDto {
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
  @IsEnum(OrganizationStatus)
  status?: OrganizationStatus;
}
