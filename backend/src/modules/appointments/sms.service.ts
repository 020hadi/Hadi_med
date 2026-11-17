import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SmsService {
  constructor(private readonly config: ConfigService) {}

  async sendOtp(phone: string, code: string): Promise<void> {
    const environment = this.config.get<string>('NODE_ENV', 'development');

    if (environment !== 'development') {
      throw new ServiceUnavailableException(
        'SMS provider is not configured for this environment',
      );
    }

    console.info(`[HadiMed DEV SMS] Phone: ${phone} | OTP: ${code}`);
  }
}
