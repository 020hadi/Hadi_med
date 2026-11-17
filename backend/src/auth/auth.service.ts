import {
  ConflictException,
  Injectable,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';

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
  ) {}

  private get secret(): string {
    const secret = this.config.getOrThrow<string>('JWT_SECRET');
    if (secret.length < 32) throw new ServiceUnavailableException('JWT_SECRET must be at least 32 characters');
    return secret;
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
          ...(dto.phone ? [{ phone: dto.phone }] : []),
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
          phone: dto.phone,
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
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: identifier.toLowerCase() }, { phone: identifier }],
      },
    });

    console.info('[AUTH_DIAG] userFound:', Boolean(user));


    const passwordMatches = user

      ? await bcrypt.compare(dto.password, user.passwordHash)

      : false;


    console.info('[AUTH_DIAG] passwordMatches:', passwordMatches);


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
