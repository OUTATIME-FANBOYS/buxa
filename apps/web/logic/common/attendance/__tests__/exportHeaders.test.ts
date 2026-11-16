import { describe, expect, it } from 'vitest';
import { BYTE_ORDER_MARK, csvHeaders, plainText } from '../exportHeaders';

describe('attendance export headers', () => {
  it('answers plain text with the status and no caching', async () => {
    const res = plainText('Choose a camp first.', 404);
    expect(res.status).toBe(404);
    expect(res.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.text()).toBe('Choose a camp first.');
  });
  it('uses the UTF-8 byte-order mark', () => {
    expect(BYTE_ORDER_MARK.charCodeAt(0)).toBe(0xfeff);
    expect(BYTE_ORDER_MARK).toHaveLength(1);
  });
  it('makes the CSV an attachment with the given file name', () => {
    expect(csvHeaders('attendance-2027-07-01-to-2027-07-03.csv')).toEqual({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="attendance-2027-07-01-to-2027-07-03.csv"',
      'Cache-Control': 'no-store',
    });
  });
});
