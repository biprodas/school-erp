import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AUTH_THROTTLE } from '~/common/throttling/throttle.constants';
import { RequestContext } from '~/common/decorators/request-context.decorator';
import { RequestContextDto } from '~/common/dto/request-context.dto';
import { AuthService } from '../services/auth.service';
import { LoginDto } from '../dto/login.dto';
import { ActivateDto } from '../dto/activate.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { VerifyEmailDto } from '../dto/verify-email.dto';
import { ResendVerificationDto } from '../dto/resend-verification.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

/** Generic message used by anti-enumeration endpoints. */
const GENERIC_EMAIL_MSG =
  'If an account exists for that email, a message has been sent.';

@ApiTags('Tenant / Auth')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get('activate')
  async verifyActivation(@Query('token') token: string) {
    const result = await this.authService.verifyActivation(token);

    return {
      success: true,
      statusCode: 200,
      message: `Activation token valid.`,
      data: result,
    };
  }

  @Post('activate')
  @Throttle(AUTH_THROTTLE)
  async activate(@Body() dto: ActivateDto) {
    const result = await this.authService.activate(dto);

    return {
      success: true,
      statusCode: 200,
      message: `Account activated.`,
      data: result,
    };
  }

  @Post('login')
  @Throttle(AUTH_THROTTLE)
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto);

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
    await this.authService.forgotPassword(dto.email);
    return {
      success: true,
      statusCode: 200,
      message: GENERIC_EMAIL_MSG,
      data: {},
    };
  }

  @Get('reset-password')
  async checkResetToken(@Query('token') token: string) {
    const data = await this.authService.checkResetToken(token);
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
    await this.authService.resetPassword(dto.token, dto.password);
    return {
      success: true,
      statusCode: 200,
      message: 'Password has been reset.',
      data: {},
    };
  }

  @Get('verify-email')
  async checkVerificationToken(@Query('token') token: string) {
    const data = await this.authService.checkVerificationToken(token);
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
    const result = await this.authService.verifyEmail(dto.token);
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
    await this.authService.resendVerification(dto.email);
    return {
      success: true,
      statusCode: 200,
      message: GENERIC_EMAIL_MSG,
      data: {},
    };
  }

  @Post('change-password')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @RequestContext() ctx: RequestContextDto,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(
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
  @UseGuards(JwtAuthGuard)
  async getMe(@RequestContext() ctx: RequestContextDto) {
    const user = await this.authService.getMe(ctx.userId!);

    return {
      success: true,
      statusCode: 200,
      message: `User found.`,
      data: user,
    };
  }
}
