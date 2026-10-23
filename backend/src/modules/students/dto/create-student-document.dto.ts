import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { IsDateOnly } from '~/common/decorators/is-date-only.decorator';
import { DocumentType } from '../enums/document-type.enum';

/** Form fields sent with the multipart `file`. */
export class CreateStudentDocumentDto {
  @IsEnum(DocumentType)
  documentType: DocumentType;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsDateOnly()
  issueDate?: string;

  @IsOptional()
  @IsDateOnly()
  expiryDate?: string;
}
