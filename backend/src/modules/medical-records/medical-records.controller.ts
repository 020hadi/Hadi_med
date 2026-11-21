import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Patch,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard, type AuthenticatedUser } from '../../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { GrantConsentDto } from './dto/grant-consent.dto.js';
import { MedicalRecordsService } from './medical-records.service.js';
import { UpdatePatientProfileDto } from './dto/update-patient-profile.dto.js';
import { CreatePatientAllergyDto } from './dto/create-patient-allergy.dto.js';
import { CreateMedicalConditionDto } from './dto/create-medical-condition.dto.js';
import { UpdatePatientAllergyDto } from './dto/update-patient-allergy.dto.js';
import { UpdateMedicalConditionDto } from './dto/update-medical-condition.dto.js';

type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};

@Controller('medical-records')
@UseGuards(JwtAuthGuard, RolesGuard)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class MedicalRecordsController {
  constructor(
    private readonly medicalRecordsService: MedicalRecordsService,
  ) {}

  private context(request: AuthenticatedRequest) {
    return {
      ipAddress: request.ip,
      userAgent: request.get('user-agent'),
    };
  }

  @Post('me')
  @Roles('PATIENT')
  createMyRecord(@Req() request: AuthenticatedRequest) {
    return this.medicalRecordsService.createMyRecord(
      request.user.id,
      this.context(request),
    );
  }

  @Get('me')
  @Roles('PATIENT')
  getMyRecord(@Req() request: AuthenticatedRequest) {
    return this.medicalRecordsService.getMyRecord(
      request.user.id,
      this.context(request),
    );
  }

  @Post('me/consents')
  @Roles('PATIENT')
  grantConsent(
    @Req() request: AuthenticatedRequest,
    @Body() body: GrantConsentDto,
  ) {
    return this.medicalRecordsService.grantConsent(
      request.user.id,
      body.doctorId,
      body.purpose,
      body.expiresAt,
      this.context(request),
    );
  }

  @Delete('me/consents/:consentId')
  @Roles('PATIENT')
  revokeConsent(
    @Req() request: AuthenticatedRequest,
    @Param('consentId') consentId: string,
  ) {
    return this.medicalRecordsService.revokeConsent(
      request.user.id,
      consentId,
      this.context(request),
    );
  }

  @Patch('me/profile')
  @Roles('PATIENT')
  updateMyProfile(
    @Req() request: AuthenticatedRequest,
    @Body() body: UpdatePatientProfileDto,
  ) {
    return this.medicalRecordsService.updateMyProfile(request.user.id, body);
  }

  @Post('me/allergies')
  @Roles('PATIENT')
  addMyAllergy(
    @Req() request: AuthenticatedRequest,
    @Body() body: CreatePatientAllergyDto,
  ) {
    return this.medicalRecordsService.addMyAllergy(request.user.id, body);
  }

  @Patch('me/allergies/:allergyId')
  @Roles('PATIENT')
  updateMyAllergy(
    @Req() request: AuthenticatedRequest,
    @Param('allergyId') allergyId: string,
    @Body() body: UpdatePatientAllergyDto,
  ) {
    return this.medicalRecordsService.updateMyAllergy(
      request.user.id,
      allergyId,
      body,
    );
  }
  @Patch('me/allergies/:allergyId/deactivate')
  @Roles('PATIENT')
  deactivateMyAllergy(
    @Req() request: AuthenticatedRequest,
    @Param('allergyId') allergyId: string,
  ) {
    return this.medicalRecordsService.deactivateMyAllergy(
      request.user.id,
      allergyId,
    );
  }

  @Post('me/conditions')
  @Roles('PATIENT')
  addMyCondition(
    @Req() request: AuthenticatedRequest,
    @Body() body: CreateMedicalConditionDto,
  ) {
    return this.medicalRecordsService.addMyCondition(request.user.id, body);
  }

  @Patch('me/conditions/:conditionId')
  @Roles('PATIENT')
  updateMyCondition(
    @Req() request: AuthenticatedRequest,
    @Param('conditionId') conditionId: string,
    @Body() body: UpdateMedicalConditionDto,
  ) {
    return this.medicalRecordsService.updateMyCondition(
      request.user.id,
      conditionId,
      body,
    );
  }
  @Patch('me/conditions/:conditionId/deactivate')
  @Roles('PATIENT')
  deactivateMyCondition(
    @Req() request: AuthenticatedRequest,
    @Param('conditionId') conditionId: string,
  ) {
    return this.medicalRecordsService.deactivateMyCondition(
      request.user.id,
      conditionId,
    );
  }
  @Get('patients/:patientProfileId')
  @Roles('DOCTOR')
  getPatientRecord(
    @Req() request: AuthenticatedRequest,
    @Param('patientProfileId') patientProfileId: string,
  ) {
    return this.medicalRecordsService.getPatientRecordForDoctor(
      request.user.id,
      patientProfileId,
      this.context(request),
    );
  }
}
