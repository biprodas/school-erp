import { IsOptional, IsString, MaxLength } from 'class-validator';

/** `GET /oauth/google/start` query. */
export class GoogleStartQueryDto {
  /** Host to come back to, e.g. `acme.example.com`. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  return?: string;

  /** Same-host path to land on (`/dashboard`). */
  @IsOptional()
  @IsString()
  @MaxLength(512)
  next?: string;

  /** `signin` (default) or `signup`; linking starts from account settings. */
  @IsOptional()
  @IsString()
  intent?: string;
}

/** Starts linking Google from account settings. */
export class StartGoogleLinkDto {
  /** The host the user is on; must be their school's (or a platform host). */
  @IsString()
  @MaxLength(255)
  returnHost: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  next?: string;
}
