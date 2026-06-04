import {
  IsString,
  IsNotEmpty,
  Length,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
  IsFQDN,
  IsDefined,
  IsUUID,
} from 'class-validator';

export class CreateTenantDto {
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @Length(3, 100)
  name: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @Length(3, 63)
  @Matches(/^[a-z0-9_]+$/, {
    message:
      'Slug must contain only lowercase letters, numbers, and underscores',
  })
  slug: string;

  @IsString()
  @Length(3, 63)
  @IsFQDN({
    require_tld: true,
    allow_underscores: false,
  })
  @IsOptional()
  domain?: string;

  /**
   * Only honored when the caller is an admin. If provided, an OWNER
   * membership is created for this user atomically with the tenant.
   */
  @IsOptional()
  @IsUUID('4')
  ownerUserId?: string;
}
