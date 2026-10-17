import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';

export class AttachGroupSubjectDto {
  @IsUUID('4')
  @IsNotEmpty()
  subjectId: string;

  @IsOptional()
  @IsBoolean()
  isCompulsory?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}
