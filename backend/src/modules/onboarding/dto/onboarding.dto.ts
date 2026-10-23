import {
  IsDefined,
  IsEmail,
  IsOptional,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class ApplyTemplateDto {
  /** Session to add the class curriculum to; defaults to the current one. */
  @IsOptional()
  @IsUUID()
  academicYearId?: string;
}

export class FindSchoolDto {
  @IsDefined()
  @IsEmail()
  @MaxLength(254)
  email: string;
}
