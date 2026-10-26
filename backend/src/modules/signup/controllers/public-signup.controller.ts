import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ResponseMessage } from '~/common/decorators/response.decorators';
import {
  AUTH_THROTTLE,
  PUBLIC_LOOKUP_THROTTLE,
} from '~/common/throttling/throttle.constants';
import {
  PreviewSignupDto,
  StartSignupDto,
  VerifySignupDto,
} from '../dto/signup.dto';
import { SignupService } from '../services/signup.service';

/** Self-serve school signup on the product domain (public). */
@ApiTags('Public / Signup')
@Controller('public/signup')
export class PublicSignupController {
  constructor(private readonly signup: SignupService) {}

  /**
   * 202 with `status: verification_sent` (the same answer whether or not
   * the email has an account), or `status: created` with a handoff redirect
   * when `googleTicket` verified the email. A reserved or taken slug is 409
   * with suggestions.
   */
  @Post()
  @HttpCode(202)
  @Throttle(PUBLIC_LOOKUP_THROTTLE)
  @ResponseMessage('Check your email to finish creating your school.')
  start(@Body() dto: StartSignupDto) {
    return this.signup.start(dto);
  }

  /**
   * What the emailed link will create (the school, its address and whether
   * that is still free, the owner), without using it. 400
   * `INVALID_SIGNUP_LINK` for an unknown, used or expired link.
   */
  @Post('preview')
  @HttpCode(200)
  @Throttle(PUBLIC_LOOKUP_THROTTLE)
  preview(@Body() dto: PreviewSignupDto) {
    return this.signup.preview(dto.token);
  }

  /** Uses the emailed link: creates the school and signs the owner in. */
  @Post('verify')
  @HttpCode(200)
  @Throttle(AUTH_THROTTLE)
  @ResponseMessage('School created.')
  verify(@Body() dto: VerifySignupDto) {
    return this.signup.verify(dto.token, dto.slug);
  }
}
