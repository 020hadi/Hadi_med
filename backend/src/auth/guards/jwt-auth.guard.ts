import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AuthService } from '../auth.service.js';

export interface AuthenticatedUser {
  id: string;
  role: string;
  sessionId: string;
}

type AuthRequest = Request & { user?: AuthenticatedUser };

type AccessTokenPayload = {
  sub: string;
  sid: string;
  typ: 'access' | 'refresh';
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Bearer token is required');
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(
        authorization.slice(7), { algorithms: ['HS256'] });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const user = await this.authService.validateAccess(payload);
    request.user = {
      id: user.id,
      role: user.role,
      sessionId: user.sessionId,
    };

    return true;
  }
}
