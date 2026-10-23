import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { DocumentVerification } from '../enums/document-verification.enum';

export class VerifyStudentDocumentDto {
  @IsIn([DocumentVerification.VERIFIED, DocumentVerification.REJECTED])
  status: DocumentVerification.VERIFIED | DocumentVerification.REJECTED;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
