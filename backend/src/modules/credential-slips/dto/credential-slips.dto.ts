import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';

export enum SlipAudience {
  GUARDIANS = 'guardians',
  STUDENTS = 'students',
  ALL = 'all',
}

export class PrintCredentialSlipsDto {
  /** Whose slips to print. Defaults to `guardians`. */
  @ApiPropertyOptional({ enum: SlipAudience })
  @IsOptional()
  @IsEnum(SlipAudience)
  audience?: SlipAudience;

  /**
   * Also print slips for accounts with an email that haven't set a
   * password (they could use their activation link instead). Default off.
   */
  @IsOptional()
  @IsBoolean()
  includeEmailAccounts?: boolean;
}
