import { randomBytes } from 'crypto';
import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SendTestEmailDto } from './dto/send-test-email.dto';
import { SendWelcomeEmailDto } from './dto/send-welcome-email.dto';
import { MailService } from './mail.service';

/**
 * Dev-only endpoint to trigger emails from Postman/curl without running a full
 * onboarding flow. Disabled in production. Mounted under `dev/` so it is easy to
 * exclude from tenant resolution and from a public deployment.
 */
@ApiTags('Dev / Mail')
@Controller('dev/mail')
export class MailController {
  constructor(
    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {}

  @Post('welcome')
  @HttpCode(200)
  @ApiOperation({ summary: 'Send a welcome email' })
  async sendWelcome(@Body() dto: SendWelcomeEmailDto) {
    await this.mailService.sendWelcomeEmail(dto.email, dto.name);

    return {
      success: true,
      statusCode: 200,
      message: `Welcome email dispatched to ${dto.email}.`,
      data: { email: dto.email, name: dto.name },
    };
  }

  @Post('test')
  @HttpCode(200)
  @ApiOperation({ summary: 'Send a test email (dev only)' })
  async sendTest(@Body() dto: SendTestEmailDto) {
    if (this.config.get<string>('app.environment') === 'production') {
      throw new ForbiddenException(
        'Test mail endpoint is disabled in production',
      );
    }

    const name = dto.name ?? 'Test User';
    const token = randomBytes(32).toString('hex');
    const type = dto.type ?? 'activation';

    if (type === 'password-reset') {
      await this.mailService.sendPasswordResetEmail(dto.to, name, token);
    } else {
      await this.mailService.sendActivationEmail(dto.to, name, token, 'demo');
    }

    return {
      success: true,
      statusCode: 200,
      message: `Test "${type}" email dispatched to ${dto.to}.`,
      data: { to: dto.to, type },
    };
  }
}
