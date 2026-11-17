import { z } from 'zod';

const scheduleItemSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid start time'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid end time'),
  slotDurationMinutes: z.number().int().min(5).max(240),
  isActive: z.boolean().default(true),
});

export const replaceSchedulesSchema = z.object({
  schedules: z.array(scheduleItemSchema).max(42),
});

export type ScheduleItemDto = z.infer<typeof scheduleItemSchema>;
export type ReplaceSchedulesDto = z.infer<typeof replaceSchedulesSchema>;
