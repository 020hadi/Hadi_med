import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DoctorVerificationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listDoctors(status?: string) {
    let verificationStatus: DoctorVerificationStatus | undefined;

    if (status) {
      const allowed = Object.values(DoctorVerificationStatus);
      if (!allowed.includes(status as DoctorVerificationStatus)) {
        throw new BadRequestException(
          'Invalid verification status',
        );
      }
      verificationStatus = status as DoctorVerificationStatus;
    }

    const doctors = await this.prisma.doctorProfile.findMany({
      where: verificationStatus ? { verificationStatus } : {},
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            firstName: true,
            lastName: true,
            status: true,
          },
        },
      },
    });

    return { doctors };
  }

  async approveDoctor(doctorId: string, adminId: string) {
    const doctor = await this.prisma.doctorProfile.findUnique({
      where: { id: doctorId },
      select: { id: true, userId: true },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor profile not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const approvedDoctor = await tx.doctorProfile.update({
        where: { id: doctorId },
        data: {
          verificationStatus: DoctorVerificationStatus.APPROVED,
          reviewedAt: new Date(),
          reviewedById: adminId,
          rejectionReason: null,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      await tx.user.update({
        where: { id: doctor.userId },
        data: { status: 'ACTIVE' },
      });

      return approvedDoctor;
    });
  }

  async rejectDoctor(
    doctorId: string,
    adminId: string,
    reason: string,
  ) {
    const doctor = await this.prisma.doctorProfile.findUnique({
      where: { id: doctorId },
      select: { id: true },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor profile not found');
    }

    return this.prisma.doctorProfile.update({
      where: { id: doctorId },
      data: {
        verificationStatus: DoctorVerificationStatus.REJECTED,
        reviewedAt: new Date(),
        reviewedById: adminId,
        rejectionReason: reason,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }
}