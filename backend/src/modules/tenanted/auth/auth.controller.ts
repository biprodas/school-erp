import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AUTH_THROTTLE } from '~/common/throttling/throttle.constants';
import { RequestContext } from '~/common/decorators/request-context.decorator';
import { RequestContextDto } from '~/common/dto/request-context.dto';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ActivateDto } from './dto/activate.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

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
