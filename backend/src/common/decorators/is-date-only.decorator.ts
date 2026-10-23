import { registerDecorator, ValidationOptions } from 'class-validator';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A calendar day as `YYYY-MM-DD` that exists (no `2026-02-30`), for `date`
 * columns. Values compare correctly as strings.
 */
export function IsDateOnly(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isDateOnly',
      target: object.constructor,
      propertyName,
      options: {
        message: `${propertyName} must be a date as YYYY-MM-DD`,
        ...options,
      },
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' &&
          DATE_ONLY.test(value) &&
          new Date(`${value}T00:00:00Z`).toISOString().startsWith(value),
      },
    });
}
