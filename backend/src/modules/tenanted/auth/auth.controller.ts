import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { RequestContext } from '~/common/decorators/request-context.decorator';
import { RequestContextDto } from '~/common/dto/request-context.dto';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto);

    return {
      success: true,
      statusCode: 201,
      message: `User created.`,
      data: result,
    };
  }

  @Post('login') 
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
