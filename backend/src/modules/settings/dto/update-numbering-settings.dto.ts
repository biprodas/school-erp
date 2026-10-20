import { IsBoolean } from 'class-validator';
import { IsNumberingPattern, OmitOrValidate } from './settings-validators';

/**
 * Patterns use `{YYYY}`, `{YY}`, `{MM}`, `{CLASS}` and exactly one `{SEQ}` /
 * `{SEQ:n}` (e.g. `{YY}{CLASS}{SEQ:4}`). Changing one affects numbers
 * issued from then on; issued numbers stay as they are.
 */
export class UpdateNumberingSettingsDto {
  @OmitOrValidate() @IsNumberingPattern() studentId?: string;
  @OmitOrValidate() @IsNumberingPattern() roll?: string;
  @OmitOrValidate() @IsNumberingPattern() receipt?: string;
  @OmitOrValidate() @IsNumberingPattern() invoice?: string;
  @OmitOrValidate() @IsNumberingPattern() certificate?: string;
  @OmitOrValidate() @IsBoolean() allowManualStudentId?: boolean;
}
