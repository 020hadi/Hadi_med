import { Module } from '@nestjs/common';
import { AppointmentsController } from './appointments.controller.js';
import { AppointmentsService } from './appointments.service.js';
import { SmsService } from './sms.service.js';

@Module({
  controllers: [AppointmentsController],
  providers: [AppointmentsService, SmsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
