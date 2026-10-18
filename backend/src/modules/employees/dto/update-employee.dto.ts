import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateEmployeeDto } from './create-employee.dto';

/** Logins are only created together with the employee. */
export class UpdateEmployeeDto extends PartialType(
  OmitType(CreateEmployeeDto, ['createUser'] as const),
) {}
