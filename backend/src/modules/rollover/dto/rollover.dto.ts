import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class RolloverIncludeDto {
  @IsOptional()
  @IsBoolean()
  sections?: boolean;

  /** Class subjects with their components, and the groups offered. */
  @IsOptional()
  @IsBoolean()
  curriculum?: boolean;

  /** Current class and subject teachers, from the target's first day. */
  @IsOptional()
  @IsBoolean()
  teachers?: boolean;
}

export const ROLLOVER_MODES = ['refuse', 'merge'] as const;
export type RolloverMode = (typeof ROLLOVER_MODES)[number];

export class RolloverDto {
  @IsUUID('4')
  @IsNotEmpty()
  fromYearId: string;

  @IsObject()
  @ValidateNested()
  @Type(() => RolloverIncludeDto)
  include: RolloverIncludeDto;

  /**
   * `refuse` (default): 409 when the target already has rows of an
   * included kind. `merge`: keep them and add only what is missing
   * (sections by class and name, subjects by class and subject).
   */
  @IsOptional()
  @IsIn(ROLLOVER_MODES)
  mode?: RolloverMode;
}

/** What the job runs with. */
export interface RolloverInput extends RolloverDto {
  targetId: string;
}
