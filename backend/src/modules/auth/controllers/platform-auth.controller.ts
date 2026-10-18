import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AUTH_THROTTLE } from '~/common/throttling/throttle.constants';
import { RequestContext } from '~/common/decorators/request-context.decorator';
import { RequestContextDto } from '~/common/dto/request-context.dto';
import { PlatformJwtAuthGuard } from '~/common/guards/platform-jwt-auth.guard';
import { PlatformLoginDto } from '../dto/platform-login.dto';
import { PlatformRegisterDto } from '../dto/platform-register.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { VerifyEmailDto } from '../dto/verify-email.dto';
import { ResendVerificationDto } from '../dto/resend-verification.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { PlatformAuthService } from '../services/platform-auth.service';
import { ResponseMessage } from '~/common/decorators/response.decorators';

/** Generic message used by anti-enumeration endpoints. */
const GENERIC_EMAIL_MSG =
  'If an account exists for that email, a message has been sent.';

@ApiTags('Platform / Auth')
@ApiBearerAuth('platform-jwt')
@Controller('platform/auth')
export class PlatformAuthController {
  constructor(private readonly platformAuthService: PlatformAuthService) {}

  @Post('register')
  @Throttle(AUTH_THROTTLE)
  @ResponseMessage('Registered. Verify your email to continue.')
  register(@Body() dto: PlatformRegisterDto) {
    return this.platformAuthService.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  @Throttle(AUTH_THROTTLE)
  @ResponseMessage('User logged in.')
  login(@Body() dto: PlatformLoginDto) {
    return this.platformAuthService.login(dto);
  }

  @Post('forgot-password')
  @HttpCode(200)
  @Throttle(AUTH_THROTTLE)
  @ResponseMessage(GENERIC_EMAIL_MSG)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.platformAuthService.forgotPassword(dto.email);
    return {};
  }

  @Get('reset-password')
  @ResponseMessage('Reset token valid.')
  checkResetToken(@Query('token') token: string) {
    return this.platformAuthService.checkResetToken(token);
  }

  @Post('reset-password')
  @HttpCode(200)
  @Throttle(AUTH_THROTTLE)
  @ResponseMessage('Password has been reset.')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.platformAuthService.resetPassword(dto.token, dto.password);
    return {};
  }

  @Get('verify-email')
  @ResponseMessage('Verification token valid.')
  checkVerificationToken(@Query('token') token: string) {
    return this.platformAuthService.checkVerificationToken(token);
  }

  @Post('verify-email')
  @HttpCode(200)
  @Throttle(AUTH_THROTTLE)
  @ResponseMessage('Email verified.')
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.platformAuthService.verifyEmail(dto.token);
  }

  @Post('resend-verification')
  @HttpCode(200)
  @Throttle(AUTH_THROTTLE)
  @ResponseMessage(GENERIC_EMAIL_MSG)
  async resendVerification(@Body() dto: ResendVerificationDto) {
    await this.platformAuthService.resendVerification(dto.email);
    return {};
  }

  @Post('change-password')
  @HttpCode(200)
  @UseGuards(PlatformJwtAuthGuard)
  @ResponseMessage('Password changed.')
  async changePassword(
    @RequestContext() ctx: RequestContextDto,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.platformAuthService.changePassword(
      ctx.userId!,
      dto.currentPassword,
      dto.newPassword,
    );
    return {};
  }

  @Get('me')
  @UseGuards(PlatformJwtAuthGuard)
  @ResponseMessage('User found.')
  getProfile(@RequestContext() ctx: RequestContextDto) {
    return this.platformAuthService.getProfile(ctx.userId!);
  }
}
