import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
} from '@nestjs/common';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { AppointmentsService } from './appointments.service.js';

import {
  requestOtpSchema,
  requestMemberOtpSchema,
  verifyOtpSchema,
  resendOtpSchema,
} from './dto/appointment.dto.js';

@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get('doctors/:doctorId/availability')
  getAvailability(
    @Param('doctorId') doctorId: string,
    @Query('date') date: string,
  ) {
    return this.appointmentsService.getAvailability(doctorId, date);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PATIENT')
  getMyAppointments(@Req() request: { user: { id: string } }) {
    return this.appointmentsService.getMyAppointments(
      request.user.id,
    );
  }

  @Delete('me/:appointmentId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PATIENT')
  cancelMyAppointment(
    @Req() request: { user: { id: string } },
    @Param('appointmentId') appointmentId: string,
  ) {
    return this.appointmentsService.cancelMyAppointment(
      request.user.id,
      appointmentId,
    );
  }
  @Post('me/request-otp')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PATIENT')
  @UsePipes(new ZodValidationPipe(requestMemberOtpSchema))
  requestMemberOtp(
    @Req() request: { user: { id: string } },
    @Body() body: unknown,
  ) {
    return this.appointmentsService.requestOtpForPatient(
      request.user.id,
      body,
    );
  }

  @Post('request-otp')
  @UsePipes(new ZodValidationPipe(requestOtpSchema))
  requestOtp(@Body() body: unknown) {
    return this.appointmentsService.requestOtp(body);
  }

  @Post('me/verify-otp')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PATIENT')
  @UsePipes(new ZodValidationPipe(verifyOtpSchema))
  verifyMemberOtp(@Req() request: { user: { id: string } }, @Body() body: unknown) {
    return this.appointmentsService.verifyOtpForPatient(request.user.id, body);
  }


  @Post('verify-otp')
  @UsePipes(new ZodValidationPipe(verifyOtpSchema))
  verifyOtp(@Body() body: unknown) {
    return this.appointmentsService.verifyOtp(body);
  }

  @Post('me/resend-otp')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PATIENT')
  @UsePipes(new ZodValidationPipe(resendOtpSchema))
  resendMemberOtp(@Req() request: { user: { id: string } }, @Body() body: unknown) {
    return this.appointmentsService.resendOtpForPatient(request.user.id, body);
  }


  @Post('resend-otp')
  @UsePipes(new ZodValidationPipe(resendOtpSchema))
  resendOtp(@Body() body: unknown) {
    return this.appointmentsService.resendOtp(body);
  }
}
