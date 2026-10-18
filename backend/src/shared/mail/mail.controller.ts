import { randomBytes } from 'crypto';
import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SendTestEmailDto } from './dto/send-test-email.dto';
import { SendWelcomeEmailDto } from './dto/send-welcome-email.dto';
import { MailService } from './mail.service';
import { ResponseMessage } from '~/common/decorators/response.decorators';

/**
 * Dev-only endpoint to trigger emails from Postman/curl without running a full
 * onboarding flow. Unauthenticated, so MailModule only registers it outside
 * production. Mounted under `dev/` so it is excluded from tenant resolution.
 */
@ApiTags('Dev / Mail')
@Controller('dev/mail')
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Post('welcome')
  @HttpCode(200)
  @ApiOperation({ summary: 'Send a welcome email' })
  @ResponseMessage('Welcome email dispatched')
  async sendWelcome(@Body() dto: SendWelcomeEmailDto) {
    await this.mailService.sendWelcomeEmail(dto.email, dto.name);

    return { email: dto.email, name: dto.name };
  }

  @Post('test')
  @HttpCode(200)
  @ApiOperation({ summary: 'Send a test email' })
  @ResponseMessage('Test email dispatched')
  async sendTest(@Body() dto: SendTestEmailDto) {
    const name = dto.name ?? 'Test User';
    const token = randomBytes(32).toString('hex');
    const type = dto.type ?? 'activation';

    if (type === 'password-reset') {
      await this.mailService.sendPasswordResetEmail(dto.to, name, token);
    } else {
      await this.mailService.sendActivationEmail(dto.to, name, token, 'demo');
    }

    return { to: dto.to, type };
  }
}
