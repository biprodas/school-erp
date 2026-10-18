import { PartialType } from '@nestjs/swagger';
import { CreateStudentDocumentDto } from './create-student-document.dto';

export class UpdateStudentDocumentDto extends PartialType(
  CreateStudentDocumentDto,
) {}
