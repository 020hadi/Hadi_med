import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed-password'),
    compare: vi.fn().mockResolvedValue(true),
  },
}));

import { AuthService } from './auth.service.js';

describe('AuthService registration and login', () => {
  const prisma = {
    user: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    userSession: { create: vi.fn().mockResolvedValue({}) },
  };
  const jwt = { signAsync: vi.fn().mockResolvedValue('test-access-token') };
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService(prisma as never, jwt as never, { getOrThrow: vi.fn().mockReturnValue('test-secret-at-least-32-characters-long') } as never);
    prisma.user.findFirst.mockResolvedValue(null);
  });

  it('registers a patient as ACTIVE and returns an access token', async () => {
    const user = {
      id: 'patient-1',
      email: 'patient@example.com',
      phone: null,
      firstName: 'Test',
      lastName: 'Patient',
      role: 'PATIENT',
      status: 'ACTIVE',
    };
    prisma.user.create.mockResolvedValue(user);

    const result = await service.register({
      email: ' Patient@Example.com ',
      password: 'StrongPass123!',
      firstName: ' Test ',
      lastName: ' Patient ',
    } as never);

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'patient@example.com',
          status: 'ACTIVE',
          patientProfile: { create: {} },
        }),
      }),
    );
    expect(result).toMatchObject({
      user,
      accessToken: 'test-access-token',
      tokenType: 'Bearer',
    });
  });

  it('registers a doctor as pending without issuing a token', async () => {
    const user = {
      id: 'doctor-1',
      email: 'doctor@example.com',
      phone: null,
      firstName: 'Test',
      lastName: 'Doctor',
      role: 'DOCTOR',
      status: 'PENDING_VERIFICATION',
    };
    prisma.user.create.mockResolvedValue(user);

    const result = await service.register({
      email: 'doctor@example.com',
      password: 'StrongPass123!',
      firstName: 'Test',
      lastName: 'Doctor',
      role: 'DOCTOR',
      licenseNumber: 'LIC-123',
    } as never);

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'PENDING_VERIFICATION',
          doctorProfile: { create: { licenseNumber: 'LIC-123', verificationStatus: 'PENDING' } },
        }),
      }),
    );
    expect(result).toMatchObject({ user, pendingVerification: true });
    expect(result).not.toHaveProperty('accessToken');
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('blocks login for a doctor awaiting verification', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'doctor-1',
      email: 'doctor@example.com',
      phone: null,
      firstName: 'Test',
      lastName: 'Doctor',
      role: 'DOCTOR',
      status: 'PENDING_VERIFICATION',
      passwordHash: 'hashed-password',
    });

    await expect(
      service.login({
        identifier: 'doctor@example.com',
        password: 'StrongPass123!',
      } as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(jwt.signAsync).not.toHaveBeenCalled();
  });
});
