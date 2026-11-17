import { z } from 'zod';

export const requestOtpSchema = z.object({
  doctorId: z.string().uuid(),
  firstName: z.string().trim().min(2).max(100),
  lastName: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(8).max(30),
  startAt: z.string().datetime({ offset: true }),
});

export type RequestOtpDto = z.infer<typeof requestOtpSchema>;

export const verifyOtpSchema = z.object({
  appointmentId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/),
});

export type VerifyOtpDto = z.infer<typeof verifyOtpSchema>;

export const resendOtpSchema = z.object({
  appointmentId: z.string().uuid(),
});

export type ResendOtpDto = z.infer<typeof resendOtpSchema>;
