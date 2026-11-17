import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsString()
  @MinLength(12)
  @MaxLength(72)
  password!: string;

  @IsString()
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @MaxLength(100)
  lastName!: string;

  @IsOptional()
  @IsIn(['PATIENT', 'DOCTOR'])
  role?: 'PATIENT' | 'DOCTOR';

  @ValidateIf((o: RegisterDto) => o.role === 'DOCTOR')
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  licenseNumber?: string;
}