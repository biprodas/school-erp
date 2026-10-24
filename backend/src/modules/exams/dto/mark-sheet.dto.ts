import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class FilterMarkSheetDto {
  @IsOptional()
  @IsUUID('4')
  classId?: string;

  @IsOptional()
  @IsUUID('4')
  sectionId?: string;
}

/** One cell of the grid. `value` is cleared when absent or exempt. */
export class MarkEntryDto {
  @IsDefined()
  @IsUUID('4')
  enrollmentId: string;

  @IsDefined()
  @IsUUID('4')
  componentId: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  value?: number | null;

  @IsOptional()
  @IsBoolean()
  absent?: boolean;

  @IsOptional()
  @IsBoolean()
  exempt?: boolean;
}

export class SaveMarksDto {
  @IsDefined()
  @IsArray()
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => MarkEntryDto)
  entries: MarkEntryDto[];
}

export class ReopenMarkSheetDto {
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}

export class BulkApproveDto {
  @IsDefined()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  markSheetIds: string[];
}
