import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateDesignationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  /**
   * Staff role given to employees invited with this designation (e.g. the
   * `teacher` role for "Assistant Teacher"); `null` clears it.
   */
  @IsOptional()
  @IsUUID('4')
  defaultRoleId?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
