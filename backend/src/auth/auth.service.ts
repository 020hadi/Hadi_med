import {
  ConflictException,
  Injectable,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { createHash, createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { SmsService } from '../common/sms/sms.service.js';

type SessionMetadata = { ip?: string; userAgent?: string };
type TokenPayload = { sub: string; sid: string; typ: 'access' | 'refresh' };

const userSelect = {
  id: true,
  email: true,
  phone: true,
  firstName: true,
  lastName: true,
  role: true,
  status: true,
} as const;

@Injectable()
export class AuthService {
  private readonly accessTtl = 900;
  private readonly refreshTtlMs = 30 * 24 * 60 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly sms: SmsService,
  ) {}

  private get secret(): string {
    const secret = this.config.getOrThrow<string>('JWT_SECRET');
    if (secret.length < 32) throw new ServiceUnavailableException('JWT_SECRET must be at least 32 characters');
    return secret;
  }

  private normalizePhone(phone: string): string {
    const cleaned = phone.replace(/[\s()-]/g, '');

    if (/^09\d{9}$/.test(cleaned)) {
      return `+98${cleaned.slice(1)}`;
    }

    if (/^\+[1-9]\d{7,14}$/.test(cleaned)) {
      return cleaned;
    }

    throw new ConflictException('Invalid phone number');
  }

  private hashPhoneOtp(code: string): string {
    return createHmac('sha256', this.secret).update(code).digest('hex');
  }

  private comparePhoneOtp(code: string, hash: string): boolean {
    const actual = Buffer.from(this.hashPhoneOtp(code), 'hex');
    const expected = Buffer.from(hash, 'hex');

    return actual.length === expected.length &&
      timingSafeEqual(actual, expected);
  }
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async createSession(
    user: { id: string; role: UserRole; email: string | null; phone: string | null; firstName: string; lastName: string; status: string },
    metadata: SessionMetadata = {},
  ) {
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + this.refreshTtlMs);

    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, sid: sessionId, typ: 'refresh' } satisfies TokenPayload,
      { secret: this.secret, expiresIn: '30d', algorithm: 'HS256' },
    );
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, sid: sessionId, typ: 'access' } satisfies TokenPayload,
      { secret: this.secret, expiresIn: this.accessTtl, algorithm: 'HS256' },
    );

    await this.prisma.userSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt,
        ipAddress: metadata.ip?.slice(0, 45),
        userAgent: metadata.userAgent,
      },
    });

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.accessTtl,
    };
  }

  async register(dto: RegisterDto, metadata: SessionMetadata = {}) {
    const email = dto.email.trim().toLowerCase();
    const role = (dto.role ?? 'PATIENT') as UserRole;

    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email },
          ...(dto.phone ? [
            { phone: this.normalizePhone(dto.phone) },
            { pendingPhone: this.normalizePhone(dto.phone) },
          ] : []),
          ...(role === 'DOCTOR' && dto.licenseNumber
            ? [{ doctorProfile: { is: { licenseNumber: dto.licenseNumber } } }]
            : []),
        ],
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Email, phone or license number already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          pendingPhone: dto.phone ? this.normalizePhone(dto.phone) : null,
          passwordHash,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          role,
          status: role === 'PATIENT' ? 'ACTIVE' : 'PENDING_VERIFICATION',
          ...(role === 'PATIENT'
            ? { patientProfile: { create: {} } }
            : {
                doctorProfile: {
                  create: {
                    licenseNumber: dto.licenseNumber!,
                    verificationStatus: 'PENDING',
                  },
                },
              }),
        },
        select: userSelect,
      });

      if (role === 'DOCTOR') {
        return {
          user,
          pendingVerification: true,
          message: 'Registration received. Your account is pending verification.',
        };
      }

      return {
        user,
        ...(await this.createSession(user, metadata)),
      };
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('An account with these details already exists');
      }
      throw error;
    }
  }

  async login(dto: LoginDto, metadata: SessionMetadata = {}) {
    const identifier = dto.identifier.trim();
    let phoneIdentifier: string | undefined;

    try {
      phoneIdentifier = this.normalizePhone(identifier);
    } catch {
      phoneIdentifier = undefined;
    }

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier.toLowerCase() },
          ...(phoneIdentifier
            ? [{ phone: phoneIdentifier, phoneVerifiedAt: { not: null } }]
            : []),
        ],
      },
    });



    const passwordMatches = user

      ? await bcrypt.compare(dto.password, user.passwordHash)

      : false;




    if (!user || !passwordMatches) {

      throw new UnauthorizedException('Invalid credentials');

    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active or is awaiting verification');
    }

    const safeUser = {
      id: user.id,
      email: user.email,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
    };

    return {
      user: safeUser,
      ...(await this.createSession(user, metadata)),
    };
  }

  async requestPhoneOtp(userId: string, rawPhone: string) {
    const phone = this.normalizePhone(rawPhone);
    const now = new Date();

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        status: true,
        phone: true,
        phoneVerifiedAt: true,
        pendingPhone: true,
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Active account required');
    }

    if (user.phone === phone && user.phoneVerifiedAt) {
      return { success: true, alreadyVerified: true };
    }

    const duplicate = await this.prisma.user.findFirst({
      where: {
        id: { not: userId },
        OR: [{ phone }, { pendingPhone: phone }],
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new ConflictException('This phone number is already in use');
    }

    const recent = await this.prisma.phoneVerificationChallenge.count({
      where: {
        userId,
        createdAt: { gte: new Date(now.getTime() - 60 * 60 * 1000) },
      },
    });

    if (recent >= 5) {
      throw new ConflictException('Too many OTP requests. Try again later.');
    }

    const code = randomInt(100000, 1000000).toString();
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);
    const resendAvailableAt = new Date(now.getTime() + 60 * 1000);

    const challenge = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { pendingPhone: phone },
      });

      await tx.phoneVerificationChallenge.updateMany({
        where: { userId, consumedAt: null },
        data: { consumedAt: now },
      });

      return tx.phoneVerificationChallenge.create({
        data: {
          userId,
          phone,
          codeHash: this.hashPhoneOtp(code),
          expiresAt,
          resendAvailableAt,
        },
      });
    });

    try {
      await this.sms.sendOtp(phone, code);
    } catch (error) {
      await this.prisma.phoneVerificationChallenge.updateMany({
        where: { id: challenge.id, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      throw error;
    }

    return {
      success: true,
      message: 'Phone verification code sent',
      expiresAt: expiresAt.toISOString(),
    };
  }

  async verifyPhoneOtp(userId: string, code: string) {
    const now = new Date();

    const challenge = await this.prisma.phoneVerificationChallenge.findFirst({
      where: {
        userId,
        consumedAt: null,
        expiresAt: { gt: now },
        user: { is: { pendingPhone: { not: null }, status: 'ACTIVE' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge) {
      throw new UnauthorizedException('No active phone verification challenge');
    }

    const attempt = await this.prisma.phoneVerificationChallenge.updateMany({
      where: {
        id: challenge.id,
        consumedAt: null,
        expiresAt: { gt: now },
        attempts: { lt: 5 },
      },
      data: { attempts: { increment: 1 } },
    });

    if (attempt.count !== 1) {
      throw new UnauthorizedException('Maximum OTP attempts reached');
    }

    if (!this.comparePhoneOtp(code, challenge.codeHash)) {
      throw new UnauthorizedException('Invalid verification code');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.phoneVerificationChallenge.updateMany({
        where: {
          id: challenge.id,
          consumedAt: null,
          expiresAt: { gt: now },
        },
        data: { consumedAt: now },
      });

      if (consumed.count !== 1) {
        throw new UnauthorizedException('Verification code is no longer valid');
      }

      const updated = await tx.user.updateMany({
        where: {
          id: userId,
          status: 'ACTIVE',
          pendingPhone: challenge.phone,
        },
        data: {
          phone: challenge.phone,
          pendingPhone: null,
          phoneVerifiedAt: now,
        },
      });

      if (updated.count !== 1) {
        throw new ConflictException('Phone number changed. Request a new code.');
      }

      return tx.user.findUnique({
        where: { id: userId },
        select: userSelect,
      });
    });

    return {
      success: true,
      message: 'Phone number verified',
      user: result,
    };
  }
  async refresh(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    let payload: TokenPayload;
    try {
      payload = await this.jwt.verifyAsync<TokenPayload>(refreshToken, {
        secret: this.secret,
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (
      payload.typ !== 'refresh' ||
      typeof payload.sub !== 'string' ||
      typeof payload.sid !== 'string'
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const oldHash = this.hashToken(refreshToken);
    const session = await this.prisma.userSession.findUnique({
      where: { id: payload.sid },
      include: { user: { select: userSelect } },
    });

    if (!session || session.userId !== payload.sub || session.revokedAt) {
      throw new UnauthorizedException('Session is no longer valid');
    }

    if (session.tokenHash !== oldHash) {
      await this.prisma.userSession.updateMany({
        where: { id: session.id, userId: payload.sub, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token reuse detected; session revoked');
    }

    if (
      session.expiresAt <= new Date() ||
      session.user.status !== 'ACTIVE'
    ) {
      throw new UnauthorizedException('Session is no longer valid');
    }

    const nextRefresh = await this.jwt.signAsync(
      { sub: payload.sub, sid: payload.sid, typ: 'refresh' } satisfies TokenPayload,
      { secret: this.secret, expiresIn: '30d', algorithm: 'HS256' },
    );
    const nextAccess = await this.jwt.signAsync(
      { sub: payload.sub, sid: payload.sid, typ: 'access' } satisfies TokenPayload,
      { secret: this.secret, expiresIn: this.accessTtl, algorithm: 'HS256' },
    );

    const rotated = await this.prisma.userSession.updateMany({
      where: {
        id: session.id,
        userId: payload.sub,
        tokenHash: oldHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: {
        tokenHash: this.hashToken(nextRefresh),
        expiresAt: new Date(Date.now() + this.refreshTtlMs),
        lastUsedAt: new Date(),
      },
    });

    if (rotated.count !== 1) {
      await this.prisma.userSession.updateMany({
        where: { id: session.id, userId: payload.sub, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token reuse detected; session revoked');
    }

    return {
      user: session.user,
      accessToken: nextAccess,
      refreshToken: nextRefresh,
      tokenType: 'Bearer',
      expiresIn: this.accessTtl,
    };
  }

  async validateAccess(payload: TokenPayload) {
    if (
      payload.typ !== 'access' ||
      typeof payload.sub !== 'string' ||
      typeof payload.sid !== 'string'
    ) {
      throw new UnauthorizedException('Invalid access token');
    }

    const session = await this.prisma.userSession.findFirst({
      where: {
        id: payload.sid,
        userId: payload.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: { select: userSelect } },
    });

    if (!session || session.user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Session is not valid');
    }

    return { ...session.user, sessionId: payload.sid };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { ...userSelect, createdAt: true },
    });

    if (!user) throw new UnauthorizedException();
    return user;
  }

  async logoutWithRefreshToken(refreshToken: string) {
    if (!refreshToken) throw new UnauthorizedException('Refresh token is required');
    let payload: TokenPayload;
    try {
      payload = await this.jwt.verifyAsync<TokenPayload>(refreshToken, {
        secret: this.secret,
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (payload.typ !== 'refresh' || typeof payload.sub !== 'string' || typeof payload.sid !== 'string') {
      throw new UnauthorizedException('Invalid refresh token');
    }
    await this.prisma.userSession.updateMany({
      where: {
        id: payload.sid,
        userId: payload.sub,
        tokenHash: this.hashToken(refreshToken),
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
    return { message: 'Logged out' };
  }

  async logout(sessionId: string, userId: string) {
    await this.prisma.userSession.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { message: 'Logged out' };
  }

  async logoutAll(userId: string) {
    await this.prisma.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { message: 'All sessions revoked' };
  }
}
