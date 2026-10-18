import { PartialType } from '@nestjs/swagger';
import { CreateStudentAddressDto } from './create-student-address.dto';

export class UpdateStudentAddressDto extends PartialType(
  CreateStudentAddressDto,
) {}
