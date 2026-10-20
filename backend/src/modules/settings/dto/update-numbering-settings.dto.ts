import { IsBoolean } from 'class-validator';
import { IsNumberingPattern } from './settings-validators';

/**
 * Patterns use `{YYYY}`, `{YY}`, `{MM}`, `{CLASS}` and exactly one `{SEQ}` /
 * `{SEQ:n}` (e.g. `{YY}{CLASS}{SEQ:4}`). Changing one affects numbers
 * issued from then on; issued numbers stay as they are.
 */
export class UpdateNumberingSettingsDto {
  @IsNumberingPattern() studentId?: string;
  @IsNumberingPattern() roll?: string;
  @IsNumberingPattern() receipt?: string;
  @IsNumberingPattern() invoice?: string;
  @IsNumberingPattern() certificate?: string;
  @IsBoolean() allowManualStudentId?: boolean;
}
