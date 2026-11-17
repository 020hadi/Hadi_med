
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  JwtAuthGuard,
  type AuthenticatedUser,
} from '../../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { DoctorsService } from './doctors.service.js';
import { replaceSchedulesSchema } from './dto/doctor-schedule.dto.js';

type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};

@Controller('doctors/me')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DOCTOR')
export class DoctorsController {
  constructor(private readonly doctorsService: DoctorsService) {}

  @Get('schedules')
  getMySchedules(@Req() request: AuthenticatedRequest) {
    return this.doctorsService.getMySchedules(request.user.id);
  }

  @Put('schedules')
  replaceMySchedules(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const result = replaceSchedulesSchema.safeParse(body);

    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        details: result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        })),
      });
    }

    return this.doctorsService.replaceMySchedules(
      request.user.id,
      result.data,
    );
  }

  @Get('appointments')
  getMyAppointments(@Req() request: AuthenticatedRequest) {
    return this.doctorsService.getMyAppointments(request.user.id);
  }
}
