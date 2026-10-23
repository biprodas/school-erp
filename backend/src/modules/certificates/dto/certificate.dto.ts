import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '~/common/dto/pagination-query.dto';
import { CertificateStatus, CertificateType } from '../enums/certificate.enum';

export class IssueCertificateDto {
  @IsEnum(CertificateType)
  type: CertificateType;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;

  /** Character / testimonial: e.g. "Good". */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  conduct?: string;

  /** TC: why the student leaves. */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  leavingReason?: string;
}

export class RevokeCertificateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}

export class FilterCertificateDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID('4')
  studentId?: string;

  @IsOptional()
  @IsEnum(CertificateType)
  type?: CertificateType;

  @IsOptional()
  @IsEnum(CertificateStatus)
  status?: CertificateStatus;
}
