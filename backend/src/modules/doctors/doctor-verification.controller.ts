import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import {
  JwtAuthGuard,
  type AuthenticatedUser,
} from '../../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { DoctorsService } from './doctors.service.js';

type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};

@Controller('doctors/me')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DOCTOR')
export class DoctorVerificationController {
  constructor(private readonly doctorsService: DoctorsService) {}

  @Get('verification')
  getMyVerification(@Req() request: AuthenticatedRequest) {
    return this.doctorsService.getMyVerification(request.user.id);
  }
}