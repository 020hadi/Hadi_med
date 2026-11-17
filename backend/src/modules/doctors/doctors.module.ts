import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module.js';
import { DoctorsController } from './doctors.controller.js';
import { PublicDoctorsController } from './public-doctors.controller.js';
import { DoctorVerificationController } from './doctor-verification.controller.js';
import { DoctorsService } from './doctors.service.js';

@Module({
  imports: [AuthModule],
  controllers: [DoctorsController, DoctorVerificationController, PublicDoctorsController],
  providers: [DoctorsService],
  exports: [DoctorsService],
})
export class DoctorsModule {}
