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
import { PlatformLoginDto } from './dto/platform-login.dto';
import { PlatformRegisterDto } from './dto/platform-register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { PlatformAuthService } from './platform-auth.service';

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
  async register(@Body() dto: PlatformRegisterDto) {
    const result = await this.platformAuthService.register(dto);
    return {
      success: true,
      statusCode: 201,
      message: 'Registered. Verify your email to continue.',
      data: result,
    };
  }

  @Post('login')
  @HttpCode(200)
  @Throttle(AUTH_THROTTLE)
  async login(@Body() dto: PlatformLoginDto) {
    const result = await this.platformAuthService.login(dto);
    return {
      success: true,
      statusCode: 200,
      message: `User logged in.`,
      data: result,
    };
  }

  @Post('forgot-password')
  @HttpCode(200)
  @Throttle(AUTH_THROTTLE)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.platformAuthService.forgotPassword(dto.email);
    return {
      success: true,
      statusCode: 200,
      message: GENERIC_EMAIL_MSG,
      data: {},
    };
  }

  @Get('reset-password')
  async checkResetToken(@Query('token') token: string) {
    const data = await this.platformAuthService.checkResetToken(token);
    return {
      success: true,
      statusCode: 200,
      message: 'Reset token valid.',
      data,
    };
  }

  @Post('reset-password')
  @HttpCode(200)
  @Throttle(AUTH_THROTTLE)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.platformAuthService.resetPassword(dto.token, dto.password);
    return {
      success: true,
      statusCode: 200,
      message: 'Password has been reset.',
      data: {},
    };
  }

  @Get('verify-email')
  async checkVerificationToken(@Query('token') token: string) {
    const data = await this.platformAuthService.checkVerificationToken(token);
    return {
      success: true,
      statusCode: 200,
      message: 'Verification token valid.',
      data,
    };
  }

  @Post('verify-email')
  @HttpCode(200)
  @Throttle(AUTH_THROTTLE)
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    const result = await this.platformAuthService.verifyEmail(dto.token);
    return {
      success: true,
      statusCode: 200,
      message: 'Email verified.',
      data: result,
    };
  }

  @Post('resend-verification')
  @HttpCode(200)
  @Throttle(AUTH_THROTTLE)
  async resendVerification(@Body() dto: ResendVerificationDto) {
    await this.platformAuthService.resendVerification(dto.email);
    return {
      success: true,
      statusCode: 200,
      message: GENERIC_EMAIL_MSG,
      data: {},
    };
  }

  @Post('change-password')
  @HttpCode(200)
  @UseGuards(PlatformJwtAuthGuard)
  async changePassword(
    @RequestContext() ctx: RequestContextDto,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.platformAuthService.changePassword(
      ctx.userId!,
      dto.currentPassword,
      dto.newPassword,
    );
    return {
      success: true,
      statusCode: 200,
      message: 'Password changed.',
      data: {},
    };
  }

  @Get('me')
  @UseGuards(PlatformJwtAuthGuard)
  async getProfile(@RequestContext() ctx: RequestContextDto) {
    const result = await this.platformAuthService.getProfile(ctx.userId!);
    return {
      success: true,
      statusCode: 200,
      message: `User found.`,
      data: result,
    };
  }
}
