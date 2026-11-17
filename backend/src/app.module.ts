import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AppointmentsModule } from './modules/appointments/appointments.module.js';
import { DoctorsModule } from './modules/doctors/doctors.module.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { envSchema } from './config/env.schema.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: (config) => envSchema.parse(config),
    }),
    AuthModule,
    PrismaModule,
    HealthModule,
    AppointmentsModule,
    DoctorsModule,
    AdminModule,
  ],
})
export class AppModule {}
