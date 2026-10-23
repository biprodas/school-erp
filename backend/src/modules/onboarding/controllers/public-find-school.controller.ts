import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ResponseMessage } from '~/common/decorators/response.decorators';
import { PUBLIC_LOOKUP_THROTTLE } from '~/common/throttling/throttle.constants';
import { FindSchoolDto } from '../dto/onboarding.dto';
import { FindSchoolService } from '../services/find-school.service';

@ApiTags('Public / Find your school')
@Controller('public/find-school')
export class PublicFindSchoolController {
  constructor(private readonly findSchool: FindSchoolService) {}

  /** Always 202 with the same message, whether or not the email is known. */
  @Post()
  @HttpCode(202)
  @Throttle(PUBLIC_LOOKUP_THROTTLE)
  @ResponseMessage(
    "If you have an account, we've sent you a link to each of your schools.",
  )
  async request(@Body() dto: FindSchoolDto) {
    await this.findSchool.request(dto.email);
    return {};
  }
}
