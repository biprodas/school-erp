import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { RollBy } from '../enums/promotion.enum';

export class PromotionOptionsDto {
  /** Default `merit` (by the old roll until results exist, M5). */
  @IsOptional()
  @IsEnum(RollBy)
  rollBy?: RollBy;

  /** Spread students evenly over the next class's sections. */
  @IsOptional()
  @IsBoolean()
  shuffleSections?: boolean;
}

export class CreatePromotionBatchDto {
  @IsUUID('4')
  @IsNotEmpty()
  fromYearId: string;

  /** A later session; its sections must exist (run rollover first). */
  @IsUUID('4')
  @IsNotEmpty()
  toYearId: string;

  @IsUUID('4')
  @IsNotEmpty()
  classId: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PromotionOptionsDto)
  options?: PromotionOptionsDto;
}
