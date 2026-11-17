import { describe, expect, it, vi } from 'vitest';
import { attendanceExportDownload } from '@/views/attendance/exportDownload';

const h = vi.hoisted(() => ({ respond: vi.fn(async () => new Response('csv')) }));
vi.mock('@/logic/composers/index.server', () => ({ attendanceExportResponse: h.respond }));

describe('attendanceExportDownload', () => {
  it('answers the request URL with the composer’s CSV response', async () => {
    const res = await attendanceExportDownload('https://camp.test/attendance/export?from=2027-07-01');
    expect(h.respond).toHaveBeenCalledWith('https://camp.test/attendance/export?from=2027-07-01');
    expect(await res.text()).toBe('csv');
  });
});
