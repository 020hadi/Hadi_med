import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SmsService } from '../../common/sms/sms.service.js';
import type {
  RequestOtpDto,
  VerifyOtpDto,
  ResendOtpDto,
} from './dto/appointment.dto.js';

const OTP_TTL_MS = 2 * 60 * 1000;
const APPOINTMENT_HOLD_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
    private readonly config: ConfigService,
  ) {}

  private getSecret(): string {
    const secret = this.config.get<string>('JWT_SECRET');
    if (!secret) throw new Error('JWT_SECRET is not configured');
    return secret;
  }

  private hashOtp(code: string): string {
    return createHmac('sha256', this.getSecret()).update(code).digest('hex');
  }

  private compareOtp(code: string, hash: string): boolean {
    const actual = Buffer.from(this.hashOtp(code), 'hex');
    const expected = Buffer.from(hash, 'hex');

    return actual.length === expected.length &&
      timingSafeEqual(actual, expected);
  }

  private generateOtp(): string {
    return randomInt(100000, 1000000).toString();
  }

  private generateTrackingCode(): string {
    return `HM-${randomBytes(5).toString('hex').toUpperCase()}`;
  }

  private normalizePhone(phone: string): string {
    const cleaned = phone.replace(/[\s()-]/g, '');

    if (/^09\d{9}$/.test(cleaned)) {
      return `+98${cleaned.slice(1)}`;
    }

    if (/^\+[1-9]\d{7,14}$/.test(cleaned)) {
      return cleaned;
    }

    throw new BadRequestException('Invalid phone number');
  }

  private validateDate(date: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException('Date must be YYYY-MM-DD');
    }

    const parsed = new Date(`${date}T12:00:00.000Z`);

    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== date
    ) {
      throw new BadRequestException('Invalid date');
    }
  }

  private localParts(instant: Date, timezone: string) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(instant);

    const get = (type: string) =>
      parts.find((part) => part.type === type)?.value ?? '';

    const weekdays: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3,
      Thu: 4, Fri: 5, Sat: 6,
    };

    return {
      year: Number(get('year')),
      month: Number(get('month')),
      day: Number(get('day')),
      hour: Number(get('hour')),
      minute: Number(get('minute')),
      dayOfWeek: weekdays[get('weekday')],
    };
  }

  private localTimeToUtc(
    date: string,
    minuteOfDay: number,
    timezone: string,
  ): Date {
    const [year, month, day] = date.split('-').map(Number);
    const hour = Math.floor(minuteOfDay / 60);
    const minute = minuteOfDay % 60;

    const target = Date.UTC(year, month - 1, day, hour, minute);
    let candidate = target;

    for (let i = 0; i < 4; i++) {
      const local = this.localParts(new Date(candidate), timezone);
      const represented = Date.UTC(
        local.year,
        local.month - 1,
        local.day,
        local.hour,
        local.minute,
      );
      candidate += target - represented;
    }

    const result = new Date(candidate);
    const check = this.localParts(result, timezone);

    if (
      check.year !== year ||
      check.month !== month ||
      check.day !== day ||
      check.hour !== hour ||
      check.minute !== minute
    ) {
      throw new BadRequestException(
        'This local time does not exist because of a daylight-saving transition',
      );
    }

    return result;
  }

  private async ensureDoctorApproved(doctorId: string): Promise<void> {
    const doctor = await this.prisma.doctorProfile.findFirst({
      where: {
        id: doctorId,
        verificationStatus: 'APPROVED',
        user: {
          is: { status: 'ACTIVE' },
        },
      },
      select: { id: true },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }
  }
  async getAvailability(doctorId: string, date: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(doctorId)) {
      throw new BadRequestException('Invalid doctor ID');
    }

    await this.ensureDoctorApproved(doctorId);
    this.validateDate(date);

    const dayOfWeek = new Date(`${date}T12:00:00.000Z`).getUTCDay();

    const schedules = await this.prisma.doctorSchedule.findMany({
      where: {
        doctorId,
        dayOfWeek,
        isActive: true,
      },
      orderBy: { startMinute: 'asc' },
    });

    if (schedules.length === 0) {
      return { doctorId, date, slots: [] };
    }

    const now = new Date();
    const slots: Array<{
      startAt: string;
      endAt: string;
      available: boolean;
    }> = [];

    for (const schedule of schedules) {
      if (
        schedule.startMinute < 0 ||
        schedule.endMinute > 1440 ||
        schedule.startMinute >= schedule.endMinute ||
        schedule.slotDurationMinutes <= 0
      ) {
        continue;
      }

      for (
        let minute = schedule.startMinute;
        minute + schedule.slotDurationMinutes <= schedule.endMinute;
        minute += schedule.slotDurationMinutes
      ) {
        const startAt = this.localTimeToUtc(
          date,
          minute,
          schedule.timezone,
        );

        const endAt = this.localTimeToUtc(
          date,
          minute + schedule.slotDurationMinutes,
          schedule.timezone,
        );

        if (startAt <= now) continue;

        const conflict = await this.prisma.appointment.findFirst({
          where: {
            doctorId,
            startAt: { lt: endAt },
            endAt: { gt: startAt },
            OR: [
              { status: 'CONFIRMED' },
              {
                status: 'PENDING_VERIFICATION',
                expiresAt: { gt: now },
              },
            ],
          },
          select: { id: true },
        });

        slots.push({
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          available: !conflict,
        });
      }
    }

    return { doctorId, date, slots };
  }

  async requestOtpForPatient(userId: string, body: unknown) {
    const input = body as { doctorId: string; startAt: string };

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        status: true,
        phone: true,
        phoneVerifiedAt: true,
        firstName: true,
        lastName: true,
        patientProfile: { select: { id: true } },
      },
    });

    if (
      !user ||
      user.status !== 'ACTIVE' ||
      user.role !== 'PATIENT'
    ) {
      throw new BadRequestException('Active patient account required');
    }

    if (!user.phone || !user.phoneVerifiedAt) {
      throw new BadRequestException('A verified phone number is required');
    }

    if (!user.patientProfile) {
      throw new BadRequestException('Patient profile is not configured');
    }

    return this.requestOtp(
      {
        doctorId: input.doctorId,
        startAt: input.startAt,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
      },
      user.patientProfile.id,
    );
  }
  async requestOtp(body: unknown, patientProfileId: string | null = null) {
    const input = body as RequestOtpDto;
    await this.ensureDoctorApproved(input.doctorId);
    const phone = this.normalizePhone(input.phone);
    const startAt = new Date(input.startAt);

    if (startAt <= new Date()) {
      throw new BadRequestException('Appointment must be in the future');
    }

    const recentRequests = await this.prisma.appointment.count({
      where: {
        phone,
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      },
    });

    if (recentRequests >= 5) {
      throw new HttpException(
        'Too many booking requests for this phone number', HttpStatus.TOO_MANY_REQUESTS);
    }

    const schedules = await this.prisma.doctorSchedule.findMany({
      where: { doctorId: input.doctorId, isActive: true },
    });

    if (schedules.length === 0) {
      throw new NotFoundException('Doctor schedule not found');
    }

    const matchingSchedule = schedules.find((schedule) => {
      const local = this.localParts(startAt, schedule.timezone);
      const minute = local.hour * 60 + local.minute;

      return (
        local.dayOfWeek === schedule.dayOfWeek &&
        minute >= schedule.startMinute &&
        minute + schedule.slotDurationMinutes <= schedule.endMinute &&
        (minute - schedule.startMinute) %
          schedule.slotDurationMinutes === 0 &&
        startAt.getSeconds() === 0 &&
        startAt.getMilliseconds() === 0
      );
    });

    if (!matchingSchedule) {
      throw new BadRequestException(
        'Selected time is not part of the doctor schedule',
      );
    }

    const endAt = new Date(
      startAt.getTime() +
      matchingSchedule.slotDurationMinutes * 60 * 1000,
    );

    const now = new Date();
    const holdExpiresAt = new Date(now.getTime() + APPOINTMENT_HOLD_MS);
    const otpExpiresAt = new Date(now.getTime() + OTP_TTL_MS);
    const resendAvailableAt = new Date(now.getTime() + RESEND_COOLDOWN_MS);
    const code = this.generateOtp();

    const appointment = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        WITH lock AS MATERIALIZED (SELECT pg_advisory_xact_lock(hashtext(${input.doctorId}))) SELECT 1::int AS locked FROM lock
      `;

      await tx.appointment.updateMany({
        where: {
          doctorId: input.doctorId,
          status: 'PENDING_VERIFICATION',
          expiresAt: { lte: now },
        },
        data: { status: 'EXPIRED' },
      });

      const conflict = await tx.appointment.findFirst({
        where: {
          doctorId: input.doctorId,
          startAt: { lt: endAt },
          endAt: { gt: startAt },
          OR: [
            { status: 'CONFIRMED' },
            {
              status: 'PENDING_VERIFICATION',
              expiresAt: { gt: now },
            },
          ],
        },
        select: { id: true },
      });

      if (conflict) {
        throw new ConflictException('This appointment slot is no longer available');
      }

      const created = await tx.appointment.create({
        data: {
          doctorId: input.doctorId,
          patientProfileId,
          firstName: input.firstName,
          lastName: input.lastName,
          phone,
          startAt,
          endAt,
          trackingCode: this.generateTrackingCode(),
          expiresAt: holdExpiresAt,
        },
      });

      await tx.otpChallenge.create({
        data: {
          appointmentId: created.id,
          codeHash: this.hashOtp(code),
          expiresAt: otpExpiresAt,
          resendAvailableAt,
        },
      });

      return created;
    });

    try {
      await this.sms.sendOtp(phone, code);
    } catch (error) {
      await this.prisma.appointment.update({
        where: { id: appointment.id },
        data: { status: 'EXPIRED', expiresAt: now },
      });
      await this.prisma.otpChallenge.updateMany({
        where: { appointmentId: appointment.id, consumedAt: null },
        data: { consumedAt: now },
      });
      throw error;
    }

    return {
      success: true,
      message: 'Verification code sent',
      appointmentId: appointment.id,
      expiresAt: otpExpiresAt.toISOString(),
      trackingCode: appointment.trackingCode,
    };
  }

  async verifyOtpForPatient(userId: string, body: unknown) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        status: true,
        patientProfile: { select: { id: true } },
      },
    });

    if (!user || user.status !== 'ACTIVE' || user.role !== 'PATIENT') {
      throw new NotFoundException('Active patient account not found');
    }
    if (!user.patientProfile) {
      throw new NotFoundException('Patient profile not found');
    }

    return this.verifyOtp(body, user.patientProfile.id);
  }
  async verifyOtp(body: unknown, patientProfileId: string | null = null) {
    const input = body as VerifyOtpDto;
    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`WITH lock AS MATERIALIZED (SELECT pg_advisory_xact_lock(hashtext(${input.appointmentId}))) SELECT 1::int AS locked FROM lock`;
      const appointment = await tx.appointment.findFirst({
        where: {
          id: input.appointmentId,
          ...(patientProfileId ? { patientProfileId } : {}),
        },
      });

      if (
        !appointment ||
        appointment.status !== 'PENDING_VERIFICATION' ||
        !appointment.expiresAt ||
        appointment.expiresAt <= now
      ) {
        return { error: 'expired' as const };
      }

      const challenge = await tx.otpChallenge.findFirst({
        where: {
          appointmentId: appointment.id,
          consumedAt: null,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!challenge || challenge.expiresAt <= now) {
        return { error: 'otp_expired' as const };
      }

      const reserved = await tx.otpChallenge.updateMany({
        where: {
          id: challenge.id,
          consumedAt: null,
          attempts: { lt: MAX_OTP_ATTEMPTS },
        },
        data: { attempts: { increment: 1 } },
      });

      if (reserved.count !== 1) {
        return { error: 'too_many_attempts' as const };
      }

      if (!this.compareOtp(input.code, challenge.codeHash)) {
        const remaining = MAX_OTP_ATTEMPTS - challenge.attempts - 1;
        return { error: 'invalid_code' as const, remaining };
      }

      const consumed = await tx.otpChallenge.updateMany({
        where: { id: challenge.id, consumedAt: null },
        data: { consumedAt: now },
      });

      if (consumed.count !== 1) {
        return { error: 'already_used' as const };
      }

      const confirmed = await tx.appointment.update({
        where: { id: appointment.id },
        data: {
          status: 'CONFIRMED',
          verifiedAt: now,
          expiresAt: null,
        },
      });

      return { appointment: confirmed };
    });

    if ('error' in result) {
      if (result.error === 'expired') {
        throw new BadRequestException('Appointment hold has expired');
      }
      if (result.error === 'otp_expired') {
        throw new BadRequestException('Verification code has expired');
      }
      if (result.error === 'too_many_attempts') {
        throw new HttpException('Maximum OTP attempts reached', HttpStatus.TOO_MANY_REQUESTS);
      }
      if (result.error === 'already_used') {
        throw new BadRequestException('Verification code has already been used');
      }
      throw new BadRequestException({
        message: 'Invalid verification code',
        details: { remainingAttempts: result.remaining },
      });
    }

    return {
      success: true,
      message: 'Appointment confirmed',
      appointment: {
        id: result.appointment.id,
        trackingCode: result.appointment.trackingCode,
        status: result.appointment.status,
        startAt: result.appointment.startAt.toISOString(),
        endAt: result.appointment.endAt.toISOString(),
      },
    };
  }

  async resendOtpForPatient(userId: string, body: unknown) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        status: true,
        patientProfile: { select: { id: true } },
      },
    });

    if (!user || user.status !== 'ACTIVE' || user.role !== 'PATIENT') {
      throw new NotFoundException('Active patient account not found');
    }
    if (!user.patientProfile) {
      throw new NotFoundException('Patient profile not found');
    }

    return this.resendOtp(body, user.patientProfile.id);
  }
  async resendOtp(body: unknown, patientProfileId: string | null = null) {
    const input = body as ResendOtpDto;
    const now = new Date();
    const code = this.generateOtp();
    const expiresAt = new Date(now.getTime() + OTP_TTL_MS);
    const resendAvailableAt = new Date(now.getTime() + RESEND_COOLDOWN_MS);

    const challenge = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`WITH lock AS MATERIALIZED (SELECT pg_advisory_xact_lock(hashtext(${input.appointmentId}))) SELECT 1::int AS locked FROM lock`;

      const appointment = await tx.appointment.findFirst({
        where: {
          id: input.appointmentId,
          ...(patientProfileId ? { patientProfileId } : {}),
        },
      });

      if (
        !appointment ||
        appointment.status !== 'PENDING_VERIFICATION' ||
        !appointment.expiresAt ||
        appointment.expiresAt <= now
      ) {
        throw new NotFoundException('Pending appointment not found or expired');
      }

      const previous = await tx.otpChallenge.findFirst({
        where: {
          appointmentId: appointment.id,
          consumedAt: null,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!previous) {
        throw new BadRequestException('No active verification challenge');
      }

      if (previous.resendAvailableAt > now) {
        throw new HttpException(
          'Please wait before requesting another code',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      if (previous.attempts >= MAX_OTP_ATTEMPTS) {
        throw new HttpException(
          'Maximum OTP attempts reached',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      const consumed = await tx.otpChallenge.updateMany({
        where: {
          id: previous.id,
          consumedAt: null,
          attempts: { lt: MAX_OTP_ATTEMPTS },
        },
        data: { consumedAt: now },
      });

      if (consumed.count !== 1) {
        throw new ConflictException('Verification code is no longer active');
      }

      const created = await tx.otpChallenge.create({
        data: {
          appointmentId: appointment.id,
          codeHash: this.hashOtp(code),
          expiresAt,
          resendAvailableAt,
        },
      });

      return {
        id: created.id,
        appointmentId: appointment.id,
        phone: appointment.phone,
      };
    });

    try {
      await this.sms.sendOtp(challenge.phone, code);
    } catch (error) {
      await this.prisma.$transaction(async (tx) => {
        await tx.otpChallenge.updateMany({
          where: { id: challenge.id, consumedAt: null },
          data: { consumedAt: new Date() },
        });

        await tx.appointment.updateMany({
          where: {
            id: challenge.appointmentId,
            status: 'PENDING_VERIFICATION',
          },
          data: {
            status: 'EXPIRED',
            expiresAt: new Date(),
          },
        });
      });

      throw error;
    }

    return {
      success: true,
      message: 'A new verification code was sent',
      expiresAt: expiresAt.toISOString(),
    };
  }

  async getMyAppointments(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        status: true,
        patientProfile: {
          select: { id: true },
        },
      },
    });

    if (
      !user ||
      user.role !== 'PATIENT' ||
      user.status !== 'ACTIVE' ||
      !user.patientProfile
    ) {
      throw new BadRequestException('Active patient account required');
    }

    const appointments = await this.prisma.appointment.findMany({
      where: {
        patientProfileId: user.patientProfile.id,
      },
      include: {
        doctor: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
            specialties: {
              include: {
                specialty: {
                  select: { name: true },
                },
              },
            },
          },
        },
      },
      orderBy: {
        startAt: 'desc',
      },
    });

    return {
      appointments: appointments.map((appointment) => ({
        id: appointment.id,
        trackingCode: appointment.trackingCode,
        status: appointment.status,
        startAt: appointment.startAt.toISOString(),
        endAt: appointment.endAt.toISOString(),
        createdAt: appointment.createdAt.toISOString(),
        doctor: {
          doctorId: appointment.doctorId,
          firstName: appointment.doctor.user.firstName,
          lastName: appointment.doctor.user.lastName,
          specialties: appointment.doctor.specialties.map(
            (item) => item.specialty.name,
          ),
        },
      })),
    };
  }

  async cancelMyAppointment(userId: string, appointmentId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        status: true,
        patientProfile: {
          select: { id: true },
        },
      },
    });

    if (
      !user ||
      user.role !== 'PATIENT' ||
      user.status !== 'ACTIVE' ||
      !user.patientProfile
    ) {
      throw new BadRequestException('Active patient account required');
    }

    const appointment = await this.prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        patientProfileId: user.patientProfile.id,
      },
      select: {
        id: true,
        status: true,
        startAt: true,
      },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (
      appointment.status !== 'CONFIRMED' ||
      appointment.startAt <= new Date()
    ) {
      throw new ConflictException(
        'Only future confirmed appointments can be cancelled',
      );
    }

    const result = await this.prisma.appointment.updateMany({
      where: {
        id: appointment.id,
        patientProfileId: user.patientProfile.id,
        status: 'CONFIRMED',
        startAt: { gt: new Date() },
      },
      data: {
        status: 'CANCELLED',
      },
    });

    if (result.count !== 1) {
      throw new ConflictException(
        'Appointment could not be cancelled',
      );
    }

    return {
      success: true,
      message: 'Appointment cancelled successfully',
    };
  }
}
