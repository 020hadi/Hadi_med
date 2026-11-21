import { IsString, Matches } from 'class-validator';

export class VerifyPhoneOtpDto {
  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;
}
