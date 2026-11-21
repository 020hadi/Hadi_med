import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module.js';
import { SmsModule } from '../../common/sms/sms.module.js';
import { AppointmentsController } from './appointments.controller.js';
import { AppointmentsService } from './appointments.service.js';

@Module({
  imports: [AuthModule, SmsModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
