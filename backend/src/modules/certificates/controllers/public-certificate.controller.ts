import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ResponseMessage } from '~/common/decorators/response.decorators';
import { PUBLIC_LOOKUP_THROTTLE } from '~/common/throttling/throttle.constants';
import { PublicCertificateService } from '../services/public-certificate.service';

/** What a certificate's QR code opens (PRD 6.6): name, type, date, status. */
@ApiTags('Public / Certificates')
@Controller('public/certificates')
export class PublicCertificateController {
  constructor(private readonly certificates: PublicCertificateService) {}

  @Get('verify/:token')
  @Throttle(PUBLIC_LOOKUP_THROTTLE)
  @ResponseMessage('Certificate verification')
  verify(@Param('token') token: string) {
    return this.certificates.verify(token);
  }
}
