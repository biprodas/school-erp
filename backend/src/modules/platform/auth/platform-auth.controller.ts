import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { RequestContext } from '~/common/decorators/request-context.decorator';
import { RequestContextDto } from '~/common/dto/request-context.dto';
import { PlatformJwtAuthGuard } from '~/common/guards/platform-jwt-auth.guard';
import { PlatformLoginDto } from './dto/platform-login.dto';
import { PlatformRegisterDto } from './dto/platform-register.dto';
import { PlatformAuthService } from './platform-auth.service';

@Controller('platform/auth')
export class PlatformAuthController {
  constructor(private readonly platformAuthService: PlatformAuthService) {}

  @Post('register')
  async register(@Body() dto: PlatformRegisterDto) {
    const result = await this.platformAuthService.register(dto);
    return {
      success: true,
      statusCode: 201,
      message: `User created.`,
      data: result,
    };
  }

  @Post('login')
  async login(@Body() dto: PlatformLoginDto) {
    const result = await this.platformAuthService.login(dto);
    return {
      success: true,
      statusCode: 200,
      message: `User logged in.`,
      data: result,
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
