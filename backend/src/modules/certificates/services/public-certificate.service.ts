import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Certificate } from '../entities/certificate.entity';
import type {
  CertificateStatus,
  CertificateType,
} from '../enums/certificate.enum';

/** What anyone scanning the QR code may learn (PRD 6.6): nothing more. */
export interface CertificateVerification {
  name: string;
  type: CertificateType;
  issuedOn: string;
  status: CertificateStatus;
}

/**
 * The public side of certificates. The token isn't tied to a host, so it
 * is looked up across schools through the root connection.
 */
@Injectable()
export class PublicCertificateService {
  constructor(
    @InjectRepository(Certificate)
    private readonly certificates: Repository<Certificate>,
  ) {}

  async verify(token: string): Promise<CertificateVerification> {
    const certificate = await this.certificates.findOne({
      where: { verifyToken: token },
    });
    if (!certificate) {
      throw new NotFoundException({
        message: 'No certificate matches this code',
        code: 'CERTIFICATE_NOT_FOUND',
      });
    }
    return {
      name: certificate.data.studentName,
      type: certificate.type,
      issuedOn: certificate.issuedAt.toISOString().slice(0, 10),
      status: certificate.status,
    };
  }
}
