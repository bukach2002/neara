import { BadRequestException } from '@nestjs/common';
import { DateTime } from 'luxon';
import { SchedulingService } from './scheduling.service';

describe('SchedulingService', () => {
  it('rejects dates outside the 30-day advance booking window', async () => {
    const service = new SchedulingService({} as never);
    const targetDay = DateTime.now().setZone('Asia/Kolkata').startOf('day').plus({ days: 31 });

    expect(() => service['assertWithinBookingWindow'](targetDay, 'Asia/Kolkata')).toThrow(BadRequestException);
  });

  it('uses override windows instead of recurring rules for the date', () => {
    const service = new SchedulingService({} as never);
    const targetDay = DateTime.fromISO('2026-06-01', { zone: 'Asia/Kolkata' }).startOf('day');

    const windows = service['windowsForDay']({
      timezone: 'Asia/Kolkata',
      targetDay,
      rules: [{ dayOfWeek: 1, startLocalTime: '09:00', endLocalTime: '17:00' }],
      exceptions: [{ type: 'override', startLocalTime: '12:00', endLocalTime: '15:00' }],
    });

    expect(windows).toHaveLength(1);
    expect(windows[0].start.toFormat('HH:mm')).toBe('12:00');
    expect(windows[0].end.toFormat('HH:mm')).toBe('15:00');
  });
});
