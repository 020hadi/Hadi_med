
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { ReplaceSchedulesDto } from './dto/doctor-schedule.dto.js';

const TIMEZONE = 'Asia/Tehran';

function toMinute(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

function toTime(minute: number): string {
  const hour = Math.floor(minute / 60);
  const min = minute % 60;
  return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function getTehranParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  const year = Number(values.year);
  const month = Number(values.month);
  const day = Number(values.day);

  return {
    dayOfWeek: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
    dateKey: `${values.year}-${values.month}-${values.day}`,
    minute: Number(values.hour) * 60 + Number(values.minute),
  };
}

@Injectable()
export class DoctorsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getDoctorProfile(userId: string) {
    const doctor = await this.prisma.doctorProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor profile not found');
    }

    return doctor;
  }

  async getMyVerification(userId: string) {
    const doctor = await this.prisma.doctorProfile.findUnique({
      where: { userId },
      select: {
        verificationStatus: true,
        reviewedAt: true,
        rejectionReason: true,
      },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor profile not found');
    }

    return doctor;
  }

  async listPublicDoctors(specialty?: string) {
    const doctors = await this.prisma.doctorProfile.findMany({
      where: {
        verificationStatus: 'APPROVED',
        user: { is: { status: 'ACTIVE' } },
        ...(specialty
          ? {
              specialties: {
                some: {
                  specialty: {
                    is: {
                      name: {
                        contains: specialty,
                        mode: 'insensitive',
                      },
                    },
                  },
                },
              },
            }
          : {}),
      },
      select: {
        id: true,
        biography: true,
        yearsExperience: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        specialties: {
          select: {
            specialty: {
              select: {
                id: true,
                name: true,
                description: true,
              },
            },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    return doctors.map((doctor) => ({
      doctorId: doctor.id,
      firstName: doctor.user.firstName,
      lastName: doctor.user.lastName,
      biography: doctor.biography,
      yearsExperience: doctor.yearsExperience,
      specialties: doctor.specialties.map((item) => item.specialty),
    }));
  }

  async getMySchedules(userId: string) {
    const doctor = await this.getDoctorProfile(userId);

    const schedules = await this.prisma.doctorSchedule.findMany({
      where: { doctorId: doctor.id },
      orderBy: [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }],
    });

    return {
      timezone: TIMEZONE,
      schedules: schedules.map((item) => ({
        id: item.id,
        dayOfWeek: item.dayOfWeek,
        startTime: toTime(item.startMinute),
        endTime: toTime(item.endMinute),
        slotDurationMinutes: item.slotDurationMinutes,
        isActive: item.isActive,
        timezone: item.timezone,
      })),
    };
  }

  async getMyAppointments(userId: string) {
    const doctor = await this.getDoctorProfile(userId);
    const now = new Date();

    const appointments = await this.prisma.appointment.findMany({
      where: {
        doctorId: doctor.id,
        OR: [
          { status: AppointmentStatus.CONFIRMED },
          {
            status: AppointmentStatus.PENDING_VERIFICATION,
            expiresAt: { gt: now },
          },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        startAt: true,
        endAt: true,
        status: true,
        trackingCode: true,
        verifiedAt: true,
        createdAt: true,
      },
      orderBy: {
        startAt: 'asc',
      },
      take: 200,
    });

    return {
      timezone: TIMEZONE,
      stats: {
        total: appointments.length,
        confirmed: appointments.filter(
          (item) => item.status === AppointmentStatus.CONFIRMED,
        ).length,
        pending: appointments.filter(
          (item) => item.status === AppointmentStatus.PENDING_VERIFICATION,
        ).length,
        upcoming: appointments.filter(
          (item) =>
            item.status === AppointmentStatus.CONFIRMED &&
            item.startAt >= now,
        ).length,
      },
      appointments,
    };
  }

  async replaceMySchedules(
    userId: string,
    data: ReplaceSchedulesDto,
  ) {
    const doctor = await this.getDoctorProfile(userId);

    const normalized = data.schedules.map((item) => ({
      dayOfWeek: item.dayOfWeek,
      startMinute: toMinute(item.startTime),
      endMinute: toMinute(item.endTime),
      slotDurationMinutes: item.slotDurationMinutes,
      timezone: TIMEZONE,
      isActive: item.isActive,
    }));

    for (const item of normalized) {
      if (item.endMinute <= item.startMinute) {
        throw new BadRequestException(
          'End time must be later than start time on the same day',
        );
      }

      if (
        item.slotDurationMinutes >
        item.endMinute - item.startMinute
      ) {
        throw new BadRequestException(
          'Appointment duration cannot exceed the working interval',
        );
      }
    }

    const activeSchedules = normalized.filter(
      (item) => item.isActive,
    );

    for (let i = 0; i < activeSchedules.length; i++) {
      for (let j = i + 1; j < activeSchedules.length; j++) {
        const a = activeSchedules[i];
        const b = activeSchedules[j];

        if (
          a.dayOfWeek === b.dayOfWeek &&
          a.startMinute < b.endMinute &&
          b.startMinute < a.endMinute
        ) {
          throw new BadRequestException(
            'Active working intervals must not overlap',
          );
        }
      }
    }

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      // Use the same doctor-level lock as appointment booking.
      await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(hashtext(${doctor.id}))
      `;

      const futureAppointments = await tx.appointment.findMany({
        where: {
          doctorId: doctor.id,
          startAt: { gte: now },
          OR: [
            { status: AppointmentStatus.CONFIRMED },
            {
              status: AppointmentStatus.PENDING_VERIFICATION,
              expiresAt: { gt: now },
            },
          ],
        },
        select: {
          id: true,
          startAt: true,
          endAt: true,
          status: true,
        },
      });

      for (const appointment of futureAppointments) {
        const start = getTehranParts(appointment.startAt);
        const end = getTehranParts(appointment.endAt);

        const covered = activeSchedules.some((schedule) => {
          return (
            schedule.dayOfWeek === start.dayOfWeek &&
            start.dateKey === end.dateKey &&
            start.minute >= schedule.startMinute &&
            end.minute <= schedule.endMinute
          );
        });

        if (!covered) {
          throw new ConflictException(
            'The new schedule conflicts with an existing future appointment. Existing appointments must remain within working hours.',
          );
        }
      }

      await tx.doctorSchedule.deleteMany({
        where: { doctorId: doctor.id },
      });

      if (normalized.length > 0) {
        await tx.doctorSchedule.createMany({
          data: normalized.map((item) => ({
            ...item,
            doctorId: doctor.id,
          })),
        });
      }
    });

    return this.getMySchedules(userId);
  }
}
