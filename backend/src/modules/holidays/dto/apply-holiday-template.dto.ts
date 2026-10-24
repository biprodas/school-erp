import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class ApplyHolidayTemplateDto {
  /** Calendar year; defaults to the current one in the school's zone. */
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;
}
