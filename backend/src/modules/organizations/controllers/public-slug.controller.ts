import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ResponseMessage } from '~/common/decorators/response.decorators';
import { PUBLIC_LOOKUP_THROTTLE } from '~/common/throttling/throttle.constants';
import { RESERVED_SLUGS, SLUG_PATTERN } from '~/shared/slug/reserved-slugs';
import { SlugService } from '../services/slug.service';

/** Slug rules and live availability for the signup form (public). */
@ApiTags('Public / Slugs')
@Controller('public/slugs')
export class PublicSlugController {
  constructor(private readonly slugs: SlugService) {}

  /** The reserved list and pattern, shared with `frontend/src/lib/tenant.ts`. */
  @Get('reserved')
  @ResponseMessage('Reserved slugs')
  reserved() {
    return { reserved: RESERVED_SLUGS, pattern: SLUG_PATTERN.source };
  }

  @Get('check')
  @Throttle(PUBLIC_LOOKUP_THROTTLE)
  @ResponseMessage('Slug checked')
  check(@Query('slug') slug?: string) {
    if (!slug || slug.length > 63) {
      throw new BadRequestException({
        message: 'slug query parameter is required',
        code: 'SLUG_INVALID',
      });
    }
    return this.slugs.check(slug);
  }
}
