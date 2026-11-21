import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { RequestPhoneOtpDto } from './dto/request-phone-otp.dto.js';
import { VerifyPhoneOtpDto } from './dto/verify-phone-otp.dto.js';
import { JwtAuthGuard, type AuthenticatedUser } from './guards/jwt-auth.guard.js';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('auth')
@UsePipes(new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
}))
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private metadata(request: Request) {
    return {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    };
  }

  @Post('register')
  register(@Body() dto: RegisterDto, @Req() request: Request) {
    return this.authService.register(dto, this.metadata(request));
  }

  @Post('login')
  login(@Body() dto: LoginDto, @Req() request: Request) {
    return this.authService.login(dto, this.metadata(request));
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() request: AuthenticatedRequest) {
    return this.authService.me(request.user.id);
  }

  @Post('phone/request-otp')
  @UseGuards(JwtAuthGuard)
  requestPhoneOtp(
    @Req() request: AuthenticatedRequest,
    @Body() dto: RequestPhoneOtpDto,
  ) {
    return this.authService.requestPhoneOtp(request.user.id, dto.phone);
  }

  @Post('phone/verify-otp')
  @UseGuards(JwtAuthGuard)
  verifyPhoneOtp(
    @Req() request: AuthenticatedRequest,
    @Body() dto: VerifyPhoneOtpDto,
  ) {
    return this.authService.verifyPhoneOtp(request.user.id, dto.code);
  }
  @Post('logout')
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logoutWithRefreshToken(dto.refreshToken);
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  logoutAll(@Req() request: AuthenticatedRequest) {
    return this.authService.logoutAll(request.user.id);
  }
}
