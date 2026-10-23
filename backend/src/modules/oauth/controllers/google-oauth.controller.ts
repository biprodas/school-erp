import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { PUBLIC_LOOKUP_THROTTLE } from '~/common/throttling/throttle.constants';
import { GoogleStartQueryDto } from '../dto/google.dto';
import { GoogleAuthService } from '../google-auth.service';

/**
 * Google sign-in redirects (doc/domains-and-routing.md 5a). Platform routes
 * on the product domain, excluded from `TenantMiddleware`.
 */
@ApiTags('Public / Google sign-in')
@Controller('oauth/google')
export class GoogleOAuthController {
  constructor(private readonly google: GoogleAuthService) {}

  /** 302 to Google; 400 for a host we don't serve, 404 when disabled. */
  @Get('start')
  @Throttle(PUBLIC_LOOKUP_THROTTLE)
  async start(@Query() query: GoogleStartQueryDto, @Res() res: Response) {
    const url = await this.google.start({
      returnHost: query.return,
      next: query.next,
      intent: query.intent,
    });
    res.redirect(302, url);
  }

  /**
   * Google's redirect: 302 back to the starting host. Read param by param:
   * Google adds parameters of its own (`scope`, `authuser`, `iss`, …).
   */
  @Get('callback')
  @Throttle(PUBLIC_LOOKUP_THROTTLE)
  async callback(
    @Query('state') state: string | undefined,
    @Query('code') code: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    this.google.assertEnabled();
    const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
    res.redirect(
      302,
      await this.google.callback({
        state: str(state),
        code: str(code),
        error: str(error),
      }),
    );
  }
}
