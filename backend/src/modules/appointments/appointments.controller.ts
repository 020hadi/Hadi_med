import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UsePipes,
} from '@nestjs/common';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { AppointmentsService } from './appointments.service.js';
import {
  requestOtpSchema,
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

  @Post('request-otp')
  @UsePipes(new ZodValidationPipe(requestOtpSchema))
  requestOtp(@Body() body: unknown) {
    return this.appointmentsService.requestOtp(body);
  }

  @Post('verify-otp')
  @UsePipes(new ZodValidationPipe(verifyOtpSchema))
  verifyOtp(@Body() body: unknown) {
    return this.appointmentsService.verifyOtp(body);
  }

  @Post('resend-otp')
  @UsePipes(new ZodValidationPipe(resendOtpSchema))
  resendOtp(@Body() body: unknown) {
    return this.appointmentsService.resendOtp(body);
  }
}
