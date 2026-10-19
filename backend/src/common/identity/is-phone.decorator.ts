import { registerDecorator, ValidationOptions } from 'class-validator';
import { normalizePhone } from './identifier';

/** A phone number `normalizePhone` accepts (BD local or E.164). */
export function IsPhone(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isPhone',
      target: object.constructor,
      propertyName,
      options: {
        message: `${propertyName} must be a valid phone number (e.g. 01712345678 or +8801712345678)`,
        ...options,
      },
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && normalizePhone(value) !== null,
      },
    });
}
