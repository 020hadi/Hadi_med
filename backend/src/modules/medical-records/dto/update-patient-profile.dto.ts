import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdatePatientProfileDto {
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  bloodType?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  emergencyContact?: string | null;
}
