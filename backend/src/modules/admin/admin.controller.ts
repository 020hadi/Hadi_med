import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import {
  JwtAuthGuard,
  type AuthenticatedUser,
} from '../../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { AdminService } from './admin.service.js';

type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};

const rejectSchema = z.object({
  rejectionReason: z.string().trim().min(5).max(1000),
});

@Controller('admin/doctors')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  listDoctors(@Query('status') status?: string) {
    return this.adminService.listDoctors(status);
  }

  @Patch(':doctorId/approve')
  approveDoctor(
    @Param('doctorId', new ParseUUIDPipe()) doctorId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.adminService.approveDoctor(
      doctorId,
      request.user.id,
    );
  }

  @Patch(':doctorId/reject')
  rejectDoctor(
    @Param('doctorId', new ParseUUIDPipe()) doctorId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const result = rejectSchema.safeParse(body);

    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        details: result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        })),
      });
    }

    return this.adminService.rejectDoctor(
      doctorId,
      request.user.id,
      result.data.rejectionReason,
    );
  }
}