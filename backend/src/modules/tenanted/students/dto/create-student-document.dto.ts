import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { DocumentType } from '../enums/document-type.enum';

export class CreateStudentDocumentDto {
  @IsEnum(DocumentType)
  documentType: DocumentType;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @IsString()
  @IsNotEmpty()
  fileUrl: string;

  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsBoolean()
  verified?: boolean;
}
