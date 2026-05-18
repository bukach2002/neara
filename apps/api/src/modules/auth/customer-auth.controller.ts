import { Body, Controller, Delete, Get, Post, Req, Res } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { RateLimit } from '../rate-limit/rate-limit.decorator';
import { CustomerAuthService } from './customer-auth.service';
import {
  CustomerLoginDto,
  CustomerOtpConfirmDto,
  CustomerOtpRequestDto,
  CustomerPasswordResetConfirmDto,
  CustomerRegisterDto,
} from './dto/customer-auth.dto';

@ApiTags('public/auth')
@Controller('public/auth')
export class CustomerAuthController {
  constructor(private readonly customerAuth: CustomerAuthService) {}

  @Post('register')
  @RateLimit('CUSTOMER_REGISTER')
  @ApiOkResponse({ description: 'Creates a customer account and customer session cookie' })
  register(@Body() dto: CustomerRegisterDto, @Res({ passthrough: true }) response: Response) {
    return this.customerAuth.register(dto, response);
  }

  @Post('login')
  @RateLimit('CUSTOMER_LOGIN')
  @ApiOkResponse({ description: 'Creates a customer session cookie using password login' })
  login(@Body() dto: CustomerLoginDto, @Res({ passthrough: true }) response: Response) {
    return this.customerAuth.login(dto, response);
  }

  @Post('otp/request')
  @RateLimit('CUSTOMER_OTP_REQUEST')
  @ApiOkResponse({ description: 'Requests an email OTP for customer login or password reset' })
  requestOtp(@Body() dto: CustomerOtpRequestDto) {
    return this.customerAuth.requestOtp(dto);
  }

  @Post('otp/confirm')
  @RateLimit('CUSTOMER_OTP_CONFIRM')
  @ApiOkResponse({ description: 'Confirms a login OTP and creates a customer session cookie' })
  confirmOtp(@Body() dto: CustomerOtpConfirmDto, @Res({ passthrough: true }) response: Response) {
    return this.customerAuth.confirmOtp(dto, response);
  }

  @Post('password-reset/request')
  @RateLimit('CUSTOMER_OTP_REQUEST')
  @ApiOkResponse({ description: 'Requests a customer password reset email OTP if the account exists' })
  requestPasswordReset(@Body() dto: CustomerOtpRequestDto) {
    return this.customerAuth.requestOtp({ ...dto, purpose: 'password_reset' });
  }

  @Post('password-reset/confirm')
  @RateLimit('CUSTOMER_OTP_CONFIRM')
  @ApiOkResponse({ description: 'Resets a customer password with a valid email OTP' })
  confirmPasswordReset(@Body() dto: CustomerPasswordResetConfirmDto) {
    return this.customerAuth.confirmPasswordReset(dto);
  }

  @Post('logout')
  @ApiCookieAuth('neara.customer.sid')
  @ApiOkResponse({ description: 'Clears the current customer session' })
  logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.customerAuth.logout(request, response);
  }

  @Get('me')
  @ApiCookieAuth('neara.customer.sid')
  @ApiOkResponse({ description: 'Returns the authenticated customer identity' })
  me(@Req() request: Request) {
    return this.customerAuth.me(request);
  }

  @Delete('me')
  @ApiCookieAuth('neara.customer.sid')
  @ApiOkResponse({ description: 'Anonymizes the current customer account and clears the customer session' })
  deleteMe(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.customerAuth.deleteMe(request, response);
  }
}
