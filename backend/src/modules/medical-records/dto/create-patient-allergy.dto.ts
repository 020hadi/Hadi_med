import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePatientAllergyDto {
  @IsString()
  @MaxLength(250)
  allergen!: string;

  @IsOptional()
  @IsString()
  reaction?: string | null;

  @IsOptional()
  @IsIn(['MILD', 'MODERATE', 'SEVERE', 'LIFE_THREATENING', 'UNKNOWN'])
  severity?: 'MILD' | 'MODERATE' | 'SEVERE' | 'LIFE_THREATENING' | 'UNKNOWN';

  @IsOptional()
  @IsString()
  notes?: string | null;
}
