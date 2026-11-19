import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@buxa/domain';
import { attendanceExportResponse } from '../exportResponse';
import { HttpError, forbidden } from '../../../http/errors';

const h = vi.hoisted(() => ({ campActor: vi.fn(), campZone: vi.fn(), exportCsv: vi.fn() }));
vi.mock('../campActor', () => ({ campActor: h.campActor, campZone: h.campZone }));
vi.mock('../../../runtime', () => ({ getRuntime: () => ({ services: { attendance: { exportCsv: h.exportCsv } } }) }));

const ACTOR = { userId: 'u-1' } as unknown as Actor;
const url = (query: string) => `https://camp.test/camp/attendance/export?${query}`;

describe('attendanceExportResponse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.campZone.mockResolvedValue('Europe/London');
  });
  it('answers 404 when no camp is selected', async () => {
    h.campActor.mockResolvedValueOnce(null);
    const res = await attendanceExportResponse(url('from=2027-07-01&to=2027-07-03'));
    expect(res.status).toBe(404);
    expect(await res.text()).toBe('Choose a camp first.');
  });
  it('answers 400 for a date range it cannot read', async () => {
    h.campActor.mockResolvedValueOnce(ACTOR);
    const res = await attendanceExportResponse(url('from=not-a-date&to=2027-07-03'));
    expect(res.status).toBe(400);
    expect(h.exportCsv).not.toHaveBeenCalled();
  });
  it('sends the CSV with a byte-order mark and the file name for the range', async () => {
    h.campActor.mockResolvedValueOnce(ACTOR);
    h.exportCsv.mockResolvedValueOnce('name,time\nÁda,09:00\n');
    const res = await attendanceExportResponse(url('from=2027-07-01&to=2027-07-03'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Disposition')).toBe(
      'attachment; filename="attendance-2027-07-01-to-2027-07-03.csv"',
    );
    // TextDecoder drops a leading byte-order mark, so the bytes are checked directly.
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes.slice(3))).toBe('name,time\nÁda,09:00\n');
    expect(h.exportCsv).toHaveBeenCalledWith(ACTOR, expect.objectContaining({ from: '2027-07-01', to: '2027-07-03' }));
  });
  it('passes the service refusal through with its status', async () => {
    h.campActor.mockResolvedValueOnce(ACTOR);
    h.exportCsv.mockRejectedValueOnce(forbidden('You cannot export attendance.'));
    const res = await attendanceExportResponse(url('from=2027-07-01&to=2027-07-03'));
    expect(res.status).toBe(403);
    expect(await res.text()).toBe('You cannot export attendance.');
  });
  it('answers other HTTP errors with their status and rethrows anything else', async () => {
    h.campActor.mockResolvedValueOnce(ACTOR);
    h.exportCsv.mockRejectedValueOnce(new HttpError(500, 'db down'));
    await expect(attendanceExportResponse(url('from=2027-07-01&to=2027-07-03'))).resolves.toMatchObject({
      status: 500,
    });
    h.campActor.mockResolvedValueOnce(ACTOR);
    h.exportCsv.mockRejectedValueOnce(new Error('crash'));
    await expect(attendanceExportResponse(url('from=2027-07-01&to=2027-07-03'))).rejects.toThrow('crash');
  });
});
