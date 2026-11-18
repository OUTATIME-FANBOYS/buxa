import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CheckInConsole } from '@/components/components/attendance/export';
import { settle } from '@buxa/domain';

vi.mock('@buxa/server/composers/attendance/searchPeople', () => ({ searchPeopleAction: () => settle(() => ({ kind: 'ok', value: [] })) }));
vi.mock('@buxa/server/composers/attendance/scanCode', () => ({ scanCodeAction: () => settle(() => ({ kind: 'ok', value: { kind: 'unknown' } })) }));

describe('CheckInConsole', () => {
  it('lays out the scan field, the result, the name search and the live announcement', () => {
    const html = renderToStaticMarkup(<CheckInConsole timeZone="Europe/London" clockFormat="24h" canOverride={false} />);
    expect(html).toContain('Scan a badge, or type a code');
    expect(html).toContain('aria-label="Result"');
    expect(html).toContain('aria-label="Find a person"');
    expect(html).toContain('role="status"');
    expect(html).toContain('Ready for the next person');
  });
});
