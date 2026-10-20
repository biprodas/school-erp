import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AUTH_THROTTLE } from '~/common/throttling/throttle.constants';
import { ReqContext } from '~/common/decorators/request-context.decorator';
import { RequestContextDto } from '~/common/dto/request-context.dto';
import { PlatformJwtAuthGuard } from '~/common/guards/platform-jwt-auth.guard';
import { PlatformLoginDto } from '../dto/platform-login.dto';
import { PlatformRegisterDto } from '../dto/platform-register.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { VerifyEmailDto } from '../dto/verify-email.dto';
import { ResendVerificationDto } from '../dto/resend-verification.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { IssueHandoffDto } from '../dto/handoff.dto';
import { PlatformAuthService } from '../services/platform-auth.service';
import { ResponseMessage } from '~/common/decorators/response.decorators';
import { AllowPendingPasswordChange } from '~/common/auth/password-change';
import { Client, type ClientInfo } from '~/common/decorators/client.decorator';
import { RefreshTokenDto } from '../dto/refresh-token.dto';

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
  login(@Body() dto: PlatformLoginDto, @Client() client: ClientInfo) {
    return this.platformAuthService.login(dto, client);
  }

  /** New token pair; the old refresh token stops working. */
  @Post('refresh')
  @HttpCode(200)
  @Throttle(AUTH_THROTTLE)
  @ResponseMessage('Session refreshed.')
  refresh(@Body() dto: RefreshTokenDto, @Client() client: ClientInfo) {
    return this.platformAuthService.refresh(dto.refreshToken, client);
  }

  /** Ends this sign-in (its refresh and access tokens). */
  @Post('logout')
  @HttpCode(200)
  @UseGuards(PlatformJwtAuthGuard)
  @AllowPendingPasswordChange()
  @ResponseMessage('Logged out.')
  async logout(@ReqContext() ctx: RequestContextDto) {
    await this.platformAuthService.logout(ctx.sessionId!);
    return {};
  }

  /** Active sign-ins on this host, newest first; `current` marks this one. */
  @Get('sessions')
  @UseGuards(PlatformJwtAuthGuard)
  @ResponseMessage('Active sessions.')
  listSessions(@ReqContext() ctx: RequestContextDto) {
    return this.platformAuthService.listSessions(ctx.userId!, ctx.sessionId!);
  }

  @Delete('sessions/:id')
  @UseGuards(PlatformJwtAuthGuard)
  @ResponseMessage('Session ended.')
  async revokeSession(
    @ReqContext() ctx: RequestContextDto,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.platformAuthService.revokeSession(ctx.userId!, id);
    return {};
  }

  /** Signs the user out everywhere: every school and the platform. */
  @Post('logout-all')
  @HttpCode(200)
  @UseGuards(PlatformJwtAuthGuard)
  @AllowPendingPasswordChange()
  @ResponseMessage('Logged out everywhere.')
  async logoutEverywhere(@ReqContext() ctx: RequestContextDto) {
    await this.platformAuthService.logoutEverywhere(ctx.userId!);
    return {};
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
  verifyEmail(@Body() dto: VerifyEmailDto, @Client() client: ClientInfo) {
    return this.platformAuthService.verifyEmail(dto.token, client);
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
  @AllowPendingPasswordChange()
  @ResponseMessage('Password changed.')
  changePassword(
    @ReqContext() ctx: RequestContextDto,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.platformAuthService.changePassword(
      ctx.userId!,
      ctx.sessionId!,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  /** Code that signs the caller in to one of their schools on its host. */
  @Post('handoff')
  @HttpCode(200)
  @UseGuards(PlatformJwtAuthGuard)
  @ResponseMessage('Sign-in code issued.')
  issueHandoff(
    @ReqContext() ctx: RequestContextDto,
    @Body() dto: IssueHandoffDto,
  ) {
    return this.platformAuthService.issueHandoff(ctx.userId!, dto.orgId);
  }

  @Get('me')
  @UseGuards(PlatformJwtAuthGuard)
  @AllowPendingPasswordChange()
  @ResponseMessage('User found.')
  getProfile(@ReqContext() ctx: RequestContextDto) {
    return this.platformAuthService.getProfile(ctx.userId!);
  }
}
