import { PartialType } from '@nestjs/swagger';
import { CreateStudentEmergencyContactDto } from './create-student-emergency-contact.dto';

export class UpdateStudentEmergencyContactDto extends PartialType(
  CreateStudentEmergencyContactDto,
) {}
