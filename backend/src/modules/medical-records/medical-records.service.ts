import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { UpdatePatientProfileDto } from './dto/update-patient-profile.dto.js';
import type { CreatePatientAllergyDto } from './dto/create-patient-allergy.dto.js';
import type { CreateMedicalConditionDto } from './dto/create-medical-condition.dto.js';
import type { UpdatePatientAllergyDto } from './dto/update-patient-allergy.dto.js';
import type { UpdateMedicalConditionDto } from './dto/update-medical-condition.dto.js';

interface AuditContext {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class MedicalRecordsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getPatientProfile(userId: string) {
    const profile = await this.prisma.patientProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!profile) {
      throw new NotFoundException('Patient profile not found');
    }

    return profile;
  }

  private async getApprovedDoctor(userId: string) {
    const doctor = await this.prisma.doctorProfile.findFirst({
      where: {
        userId,
        verificationStatus: 'APPROVED',
        user: { is: { status: 'ACTIVE' } },
      },
      select: { id: true },
    });

    if (!doctor) {
      throw new ForbiddenException(
        'An active, approved doctor profile is required',
      );
    }

    return doctor;
  }

  private async writeAudit(
    tx: any,
    medicalRecordId: string,
    actorId: string,
    action:
      | 'VIEW'
      | 'CREATE'
      | 'CONSENT_GRANTED'
      | 'CONSENT_REVOKED',
    context?: AuditContext,
    reason?: string,
  ) {
    await tx.medicalRecordAccessLog.create({
      data: {
        medicalRecordId,
        actorId,
        action,
        reason,
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
      },
    });
  }

  async createMyRecord(userId: string, context: AuditContext) {
    const profile = await this.getPatientProfile(userId);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.medicalRecord.findUnique({
          where: { patientProfileId: profile.id },
          select: { id: true },
        });

        if (existing) {
          throw new ConflictException('Medical record already exists');
        }

        const record = await tx.medicalRecord.create({
          data: {
            patientProfileId: profile.id,
            createdById: userId,
          },
        });

        await this.writeAudit(
          tx,
          record.id,
          userId,
          'CREATE',
          context,
          'Patient created their medical record',
        );

        return record;
      });
    } catch (error) {
      if (
        error instanceof ConflictException
      ) {
        throw error;
      }

      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Medical record already exists');
      }

      throw error;
    }
  }

  async getMyRecord(userId: string, context: AuditContext) {
    const profile = await this.getPatientProfile(userId);

    return this.prisma.$transaction(async (tx) => {
      const record = await tx.medicalRecord.findUnique({
        where: { patientProfileId: profile.id },
        include: {
          patientProfile: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  phone: true,
                },
              },
              allergies: { orderBy: { createdAt: 'desc' } },
              conditions: {
                orderBy: { createdAt: 'desc' },
              },
            },
          },
          encounters: {
            orderBy: { createdAt: 'desc' },
            include: {
              doctor: {
                select: {
                  id: true,
                  user: {
                    select: {
                      firstName: true,
                      lastName: true,
                    },
                  },
                },
              },
              diagnoses: {
                orderBy: { createdAt: 'desc' },
              },
              prescriptions: {
                orderBy: { createdAt: 'desc' },
                include: {
                  items: {
                    orderBy: { createdAt: 'asc' },
                  },
                },
              },
            },
          },
          vitalSigns: {
            orderBy: { measuredAt: 'desc' },
          },
          labResults: {
            orderBy: { createdAt: 'desc' },
          },
          documents: {
            orderBy: { createdAt: 'desc' },
          },
          consents: {
            orderBy: { createdAt: 'desc' },
            include: {
              doctor: {
                select: {
                  id: true,
                  user: {
                    select: {
                      firstName: true,
                      lastName: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!record) {
        throw new NotFoundException(
          'Medical record not found. Create your record first.',
        );
      }

      await this.writeAudit(
        tx,
        record.id,
        userId,
        'VIEW',
        context,
        'Patient viewed own medical record',
      );

      return record;
    });
  }

  async grantConsent(
    userId: string,
    doctorId: string,
    purpose: string | undefined,
    expiresAt: string | undefined,
    context: AuditContext,
  ) {
    const profile = await this.getPatientProfile(userId);

    const doctor = await this.prisma.doctorProfile.findFirst({
      where: {
        id: doctorId,
        verificationStatus: 'APPROVED',
        user: { is: { status: 'ACTIVE' } },
      },
      select: { id: true },
    });

    if (!doctor) {
      throw new NotFoundException('Approved doctor not found');
    }

    const expiration = expiresAt ? new Date(expiresAt) : null;

    if (expiration && expiration <= new Date()) {
      throw new ConflictException(
        'Consent expiration must be in the future',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const record = await tx.medicalRecord.findUnique({
        where: { patientProfileId: profile.id },
        select: { id: true, status: true },
      });

      if (!record || record.status !== 'ACTIVE') {
        throw new NotFoundException('Active medical record not found');
      }

      const existing = await tx.medicalRecordConsent.findFirst({
        where: {
          medicalRecordId: record.id,
          doctorId: doctor.id,
          grantedById: userId,
          status: 'ACTIVE',
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
        select: { id: true },
      });

      if (existing) {
        throw new ConflictException(
          'An active consent already exists for this doctor',
        );
      }

      const consent = await tx.medicalRecordConsent.create({
        data: {
          medicalRecordId: record.id,
          doctorId: doctor.id,
          grantedById: userId,
          purpose,
          expiresAt: expiration,
        },
      });

      await this.writeAudit(
        tx,
        record.id,
        userId,
        'CONSENT_GRANTED',
        context,
        'Patient granted doctor access',
      );

      return consent;
    });
  }

  async revokeConsent(
    userId: string,
    consentId: string,
    context: AuditContext,
  ) {
    const profile = await this.getPatientProfile(userId);

    return this.prisma.$transaction(async (tx) => {
      const consent = await tx.medicalRecordConsent.findFirst({
        where: {
          id: consentId,
          grantedById: userId,
          medicalRecord: {
            is: { patientProfileId: profile.id },
          },
          status: 'ACTIVE',
        },
        select: {
          id: true,
          medicalRecordId: true,
        },
      });

      if (!consent) {
        throw new NotFoundException('Active consent not found');
      }

      const updated = await tx.medicalRecordConsent.updateMany({
        where: {
          id: consent.id,
          grantedById: userId,
          status: 'ACTIVE',
        },
        data: {
          status: 'REVOKED',
          revokedAt: new Date(),
        },
      });

      if (updated.count !== 1) {
        throw new ConflictException('Consent is no longer active');
      }

      await this.writeAudit(
        tx,
        consent.medicalRecordId,
        userId,
        'CONSENT_REVOKED',
        context,
        'Patient revoked doctor access',
      );

      return { success: true, message: 'Consent revoked' };
    });
  }

  async updateMyProfile(userId: string, dto: UpdatePatientProfileDto) {
    const profile = await this.prisma.patientProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!profile) {
      throw new NotFoundException('Patient profile not found.');
    }

    if (dto.dateOfBirth) {
      const date = new Date(dto.dateOfBirth);
      if (Number.isNaN(date.getTime()) || date > new Date()) {
        throw new ConflictException('Date of birth is invalid.');
      }
    }

    const data: Record<string, unknown> = {};

    if (dto.dateOfBirth !== undefined) {
      data.dateOfBirth = dto.dateOfBirth ? new Date(dto.dateOfBirth) : null;
    }
    if (dto.bloodType !== undefined) {
      data.bloodType = dto.bloodType?.trim() || null;
    }
    if (dto.emergencyContact !== undefined) {
      data.emergencyContact = dto.emergencyContact?.trim() || null;
    }

    return this.prisma.patientProfile.update({
      where: { id: profile.id },
      data,
      select: {
        id: true,
        dateOfBirth: true,
        bloodType: true,
        emergencyContact: true,
        updatedAt: true,
      },
    });
  }

  async addMyAllergy(userId: string, dto: CreatePatientAllergyDto) {
    const profile = await this.prisma.patientProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!profile) {
      throw new NotFoundException('Patient profile not found.');
    }

    const allergen = dto.allergen.trim();
    if (!allergen) {
      throw new ConflictException('Allergen is required.');
    }

    return this.prisma.patientAllergy.create({
      data: {
        patientProfileId: profile.id,
        allergen,
        reaction: dto.reaction?.trim() || null,
        severity: (dto.severity ?? 'UNKNOWN') as any,
        notes: dto.notes?.trim() || null,
      },
    });
  }


  async updateMyAllergy(
    userId: string,
    allergyId: string,
    dto: UpdatePatientAllergyDto,
  ) {
    const profile = await this.getPatientProfile(userId);
    const data: any = {};

    if (dto.allergen !== undefined) {
      const allergen = dto.allergen.trim();
      if (!allergen) {
        throw new ConflictException('Allergen is required.');
      }
      data.allergen = allergen;
    }
    if (dto.reaction !== undefined) data.reaction = dto.reaction?.trim() || null;
    if (dto.severity !== undefined) data.severity = dto.severity;
    if (dto.notes !== undefined) data.notes = dto.notes?.trim() || null;

    if (Object.keys(data).length === 0) {
      throw new ConflictException('At least one field is required.');
    }

    const result = await this.prisma.patientAllergy.updateMany({
      where: { id: allergyId, patientProfileId: profile.id },
      data,
    });

    if (result.count !== 1) {
      throw new NotFoundException('Allergy not found.');
    }

    return this.prisma.patientAllergy.findFirst({
      where: { id: allergyId, patientProfileId: profile.id },
    });
  }
  async deactivateMyAllergy(userId: string, allergyId: string) {
    const profile = await this.prisma.patientProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!profile) {
      throw new NotFoundException('Patient profile not found.');
    }

    const result = await this.prisma.patientAllergy.updateMany({
      where: {
        id: allergyId,
        patientProfileId: profile.id,
        isActive: true,
      },
      data: { isActive: false },
    });

    if (result.count !== 1) {
      throw new NotFoundException('Active allergy not found.');
    }

    return { success: true, message: 'Allergy deactivated.' };
  }

  async addMyCondition(userId: string, dto: CreateMedicalConditionDto) {
    const profile = await this.prisma.patientProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!profile) {
      throw new NotFoundException('Patient profile not found.');
    }

    const title = dto.title.trim();
    if (!title) {
      throw new ConflictException('Condition title is required.');
    }

    return this.prisma.medicalCondition.create({
      data: {
        patientProfileId: profile.id,
        title,
        code: dto.code?.trim() || null,
        description: dto.description?.trim() || null,
        diagnosedAt: dto.diagnosedAt ? new Date(dto.diagnosedAt) : null,
      },
    });
  }


  async updateMyCondition(
    userId: string,
    conditionId: string,
    dto: UpdateMedicalConditionDto,
  ) {
    const profile = await this.getPatientProfile(userId);
    const data: any = {};

    if (dto.title !== undefined) {
      const title = dto.title.trim();
      if (!title) {
        throw new ConflictException('Condition title is required.');
      }
      data.title = title;
    }
    if (dto.code !== undefined) data.code = dto.code?.trim() || null;
    if (dto.description !== undefined) {
      data.description = dto.description?.trim() || null;
    }
    if (dto.diagnosedAt !== undefined) {
      data.diagnosedAt = dto.diagnosedAt ? new Date(dto.diagnosedAt) : null;
    }

    if (Object.keys(data).length === 0) {
      throw new ConflictException('At least one field is required.');
    }

    const result = await this.prisma.medicalCondition.updateMany({
      where: { id: conditionId, patientProfileId: profile.id },
      data,
    });

    if (result.count !== 1) {
      throw new NotFoundException('Medical condition not found.');
    }

    return this.prisma.medicalCondition.findFirst({
      where: { id: conditionId, patientProfileId: profile.id },
    });
  }
  async deactivateMyCondition(userId: string, conditionId: string) {
    const profile = await this.prisma.patientProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!profile) {
      throw new NotFoundException('Patient profile not found.');
    }

    const result = await this.prisma.medicalCondition.updateMany({
      where: {
        id: conditionId,
        patientProfileId: profile.id,
        isActive: true,
      },
      data: {
        isActive: false,
        resolvedAt: new Date(),
      },
    });

    if (result.count !== 1) {
      throw new NotFoundException('Active medical condition not found.');
    }

    return { success: true, message: 'Medical condition deactivated.' };
  }
  async getPatientRecordForDoctor(
    doctorUserId: string,
    patientProfileId: string,
    context: AuditContext,
  ) {
    const doctor = await this.getApprovedDoctor(doctorUserId);
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const record = await tx.medicalRecord.findUnique({
        where: { patientProfileId },
        include: {
          patientProfile: {
            select: {
              id: true,
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          encounters: {
            orderBy: { createdAt: 'desc' },
          },
          vitalSigns: {
            orderBy: { createdAt: 'desc' },
          },
          labResults: {
            orderBy: { createdAt: 'desc' },
          },

        },
      });

      if (!record || record.status !== 'ACTIVE') {
        throw new NotFoundException('Active medical record not found');
      }

      const consent = await tx.medicalRecordConsent.findFirst({
        where: {
          medicalRecordId: record.id,
          doctorId: doctor.id,
          grantedById: record.patientProfile.user.id,
          status: 'ACTIVE',
          revokedAt: null,
          startsAt: { lte: now },
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: now } },
          ],
        },
        select: { id: true },
      });

      if (!consent) {
        throw new ForbiddenException(
          'Valid patient consent is required',
        );
      }

      const treatmentRelationship =
        await tx.clinicalEncounter.count({
          where: {
            medicalRecordId: record.id,
            doctorId: doctor.id,
            status: { in: ['SIGNED', 'AMENDED'] },
          },
        });

      if (treatmentRelationship < 1) {
        throw new ForbiddenException(
          'A documented treatment relationship is required',
        );
      }

      await this.writeAudit(
        tx,
        record.id,
        doctorUserId,
        'VIEW',
        context,
        'Approved doctor viewed an authorized patient record',
      );

      return record;
    });
  }
}
