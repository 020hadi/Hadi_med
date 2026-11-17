import { Controller, Get, Query } from '@nestjs/common';
import { DoctorsService } from './doctors.service.js';

@Controller('doctors')
export class PublicDoctorsController {
  constructor(private readonly doctorsService: DoctorsService) {}

  @Get()
  list(@Query('specialty') specialty?: string) {
    return this.doctorsService.listPublicDoctors(specialty?.trim() || undefined);
  }
}