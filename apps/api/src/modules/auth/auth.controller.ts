import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { RateLimit } from '../rate-limit/rate-limit.decorator';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@ApiTags('admin/auth')
@Controller('admin/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @RateLimit('ADMIN_LOGIN')
  @ApiOkResponse({ description: 'Creates a secure admin session cookie' })
  async login(@Body() dto: LoginDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.authService.login(dto, request, response);
  }

  @Post('password-reset/request')
  @RateLimit('PASSWORD_RESET')
  @ApiOkResponse({ description: 'Requests an admin password reset email if the account exists' })
  async requestPasswordReset(@Body() dto: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(dto);
  }

  @Post('password-reset/confirm')
  @RateLimit('PASSWORD_RESET')
  @ApiOkResponse({ description: 'Resets an admin password with a valid reset token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('logout')
  @ApiCookieAuth('neara.sid')
  @ApiOkResponse({ description: 'Clears the current admin session' })
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.authService.logout(request, response);
  }

  @Get('me')
  @ApiCookieAuth('neara.sid')
  @ApiOkResponse({ description: 'Returns the authenticated admin identity' })
  async me(@Req() request: Request) {
    const context = await this.authService.requireAdminContext(request, { requireCsrf: false });
    return this.authService.serializeContext(context);
  }
}
