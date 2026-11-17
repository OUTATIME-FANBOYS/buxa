import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CheckInConsole } from '../CheckInConsole';

vi.mock('@/logic/composers/attendance/searchPeople', () => ({ searchPeopleAction: async () => ({ kind: 'ok', value: [] }) }));
vi.mock('@/logic/composers/attendance/scanCode', () => ({ scanCodeAction: async () => ({ kind: 'ok', value: { kind: 'unknown' } }) }));

describe('CheckInConsole', () => {
  it('lays out the scan field, the result, the name search and the live announcement', () => {
    const html = renderToStaticMarkup(<CheckInConsole timeZone="Europe/London" canOverride={false} />);
    expect(html).toContain('Scan a badge, or type a code');
    expect(html).toContain('aria-label="Result"');
    expect(html).toContain('aria-label="Find a person"');
    expect(html).toContain('role="status"');
    expect(html).toContain('Ready for the next person');
  });
});
