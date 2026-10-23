import { PartialType } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { SubjectComponent } from '../enums/subject-component.enum';

export class CreateClassSubjectComponentDto {
  @IsEnum(SubjectComponent)
  component: SubjectComponent;

  @IsInt()
  @Min(1)
  fullMarks: number;

  /** At most `fullMarks`. */
  @IsOptional()
  @IsInt()
  @Min(0)
  passMarks?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateClassSubjectComponentDto extends PartialType(
  CreateClassSubjectComponentDto,
) {}
