import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateMedicalConditionDto {
  @IsOptional()
  @IsString()
  @MaxLength(250)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsDateString()
  diagnosedAt?: string | null;
}