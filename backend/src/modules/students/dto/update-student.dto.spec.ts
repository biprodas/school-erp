import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { UpdateStudentDto } from './update-student.dto';

// Same options as the global pipe in src/app.setup.ts.
const pipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  skipUndefinedProperties: true,
  forbidNonWhitelisted: true,
});

const validate = (body: object) =>
  pipe.transform(body, { type: 'body', metatype: UpdateStudentDto });

describe('UpdateStudentDto (PartialType of CreateStudentDto)', () => {
  it('accepts any subset of the create fields', async () => {
    await expect(validate({ firstName: 'Ada' })).resolves.toEqual({
      firstName: 'Ada',
    });
    await expect(validate({})).resolves.toEqual({});
  });

  it('keeps the create rules for fields that are sent', async () => {
    await expect(validate({ firstName: '' })).rejects.toThrow(
      BadRequestException,
    );
    await expect(validate({ status: 'not-a-status' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects createUser, which only exists on create', async () => {
    await expect(
      validate({ createUser: { email: 'a@b.co', password: 'secret123' } }),
    ).rejects.toThrow(BadRequestException);
  });
});
