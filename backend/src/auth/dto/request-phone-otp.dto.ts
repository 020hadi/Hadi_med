import { IsString, MaxLength, MinLength } from 'class-validator';

export class RequestPhoneOtpDto {
  @IsString()
  @MinLength(8)
  @MaxLength(30)
  phone!: string;
}
