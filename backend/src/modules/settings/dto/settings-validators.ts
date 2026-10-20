import {
  ValidateIf,
  ValidationOptions,
  registerDecorator,
} from 'class-validator';
import { assertValidPattern } from '~/modules/numbering/numbering-pattern';

/**
 * Optional, but not nullable: the field may be left out of a patch, and
 * `null` is validated (and rejected) like any other value. Use
 * `@IsOptional()` for fields where `null` means "clear it".
 */
export const OmitOrValidate = () =>
  ValidateIf((_obj: object, value: unknown) => value !== undefined);

/** A numbering pattern with exactly one `{SEQ}` (see `formatNumber`). */
export function IsNumberingPattern(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isNumberingPattern',
      target: object.constructor,
      propertyName,
      options: {
        message: `${propertyName} must contain exactly one {SEQ} token`,
        ...options,
      },
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string' || value.length > 40) return false;
          try {
            assertValidPattern(value);
            return true;
          } catch {
            return false;
          }
        },
      },
    });
}
