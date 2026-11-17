import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { DoctorVerificationStatus } from '@prisma/client';
import { AdminService } from './admin.service.js';

describe('AdminService doctor approval', () => {
  const doctorProfile = { findUnique: vi.fn(), update: vi.fn() };
  const user = { update: vi.fn() };
  const tx = { doctorProfile, user };
  const prisma = {
    doctorProfile,
    $transaction: vi.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)),
  };
  let service: AdminService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AdminService(prisma as never);
    doctorProfile.findUnique.mockResolvedValue({ id: 'doctor-1', userId: 'user-1' });
    doctorProfile.update.mockResolvedValue({ id: 'doctor-1' });
  });

  it('approves the doctor and activates the linked user in one transaction', async () => {
    const result = await service.approveDoctor('doctor-1', 'admin-1');

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(doctorProfile.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'doctor-1' },
      data: expect.objectContaining({
        verificationStatus: DoctorVerificationStatus.APPROVED,
        reviewedById: 'admin-1',
        rejectionReason: null,
      }),
    }));
    expect(user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { status: 'ACTIVE' },
    });
    expect(result).toEqual({ id: 'doctor-1' });
  });

  it('throws when the doctor profile does not exist', async () => {
    doctorProfile.findUnique.mockResolvedValue(null);

    await expect(service.approveDoctor('missing', 'admin-1'))
      .rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
