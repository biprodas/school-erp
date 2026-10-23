import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PromotionOutcome } from '../enums/promotion.enum';

/**
 * A manual override on a draft item. A new outcome resets the target
 * (next class, same class for `detain`, none for `graduate`) unless
 * `toSectionId` is given too.
 */
export class UpdatePromotionItemDto {
  @IsOptional()
  @IsEnum(PromotionOutcome)
  outcome?: PromotionOutcome;

  /** A section of the target class in the next session. */
  @IsOptional()
  @IsUUID('4')
  toSectionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  newRoll?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
