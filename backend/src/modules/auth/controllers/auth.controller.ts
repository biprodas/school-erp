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
import { ExchangeHandoffDto } from '../dto/handoff.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ResponseMessage } from '~/common/decorators/response.decorators';

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
  @ResponseMessage('Activation token valid.')
  verifyActivation(@Query('token') token: string) {
    return this.authService.verifyActivation(token);
  }

  @Post('activate')
  @Throttle(AUTH_THROTTLE)
  @ResponseMessage('Account activated.')
  activate(@Body() dto: ActivateDto) {
    return this.authService.activate(dto);
  }

  @Post('login')
  @Throttle(AUTH_THROTTLE)
  @ResponseMessage('User logged in.')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /** Exchange a cross-host handoff code for a session on this school host. */
  @Post('handoff')
  @HttpCode(200)
  @Throttle(AUTH_THROTTLE)
  @ResponseMessage('User logged in.')
  exchangeHandoff(@Body() dto: ExchangeHandoffDto) {
    return this.authService.exchangeHandoff(dto.code);
  }

  @Post('forgot-password')
  @HttpCode(200)
  @Throttle(AUTH_THROTTLE)
  @ResponseMessage(GENERIC_EMAIL_MSG)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
    return {};
  }

  @Get('reset-password')
  @ResponseMessage('Reset token valid.')
  checkResetToken(@Query('token') token: string) {
    return this.authService.checkResetToken(token);
  }

  @Post('reset-password')
  @HttpCode(200)
  @Throttle(AUTH_THROTTLE)
  @ResponseMessage('Password has been reset.')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.password);
    return {};
  }

  @Get('verify-email')
  @ResponseMessage('Verification token valid.')
  checkVerificationToken(@Query('token') token: string) {
    return this.authService.checkVerificationToken(token);
  }

  @Post('verify-email')
  @HttpCode(200)
  @Throttle(AUTH_THROTTLE)
  @ResponseMessage('Email verified.')
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token);
  }

  @Post('resend-verification')
  @HttpCode(200)
  @Throttle(AUTH_THROTTLE)
  @ResponseMessage(GENERIC_EMAIL_MSG)
  async resendVerification(@Body() dto: ResendVerificationDto) {
    await this.authService.resendVerification(dto.email);
    return {};
  }

  @Post('change-password')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ResponseMessage('Password changed.')
  async changePassword(
    @RequestContext() ctx: RequestContextDto,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(
      ctx.userId!,
      dto.currentPassword,
      dto.newPassword,
    );
    return {};
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ResponseMessage('User found.')
  getMe(@RequestContext() ctx: RequestContextDto) {
    return this.authService.getMe(ctx.userId!);
  }
}
