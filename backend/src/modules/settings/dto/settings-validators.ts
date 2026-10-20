import { ValidationOptions, registerDecorator } from 'class-validator';
import { assertValidPattern } from '~/modules/numbering/numbering-pattern';

/*
 * Settings DTOs are patches: the global ValidationPipe runs with
 * `skipUndefinedProperties`, so a field left out is not validated, while
 * `null` is validated (and rejected) like any other value. Fields where
 * `null` means "clear it" add `@IsOptional()`; nested objects add
 * `@IsObject()`, since `@ValidateNested()` alone would accept an array.
 */

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
