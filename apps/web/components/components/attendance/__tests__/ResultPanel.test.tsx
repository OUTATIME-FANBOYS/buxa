import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CheckInState } from '@buxa/shared';
import type { PersonCard } from '@buxa/shared';
import { ResultPanel } from '@/components/components/attendance/export';

vi.mock('@buxa/server/composers/attendance/checkIn', () => ({ checkInAction: async () => ({ kind: 'ok', value: { ok: false, reason: 'archived' } }) }));

const card = { person: { id: 'p-1', givenName: 'Ada', familyName: 'Lee', preferredName: null, status: 'valid', roles: [] }, onSiteSince: null } as unknown as PersonCard;
const props = { timeZone: 'Europe/London', clockFormat: '24h' as const, canOverride: false, onCheckIn: () => undefined, onClear: () => undefined };
const render = (state: CheckInState, extra: Partial<typeof props> = {}) => renderToStaticMarkup(<ResultPanel state={state} {...props} {...extra} />);

describe('ResultPanel', () => {
  it('waits for the next person when idle', () => {
    expect(render({ phase: 'idle' } as CheckInState)).toContain('Ready for the next person');
  });
  it('says a code was not recognised, and shows a lookup error', () => {
    expect(render({ phase: 'unknown' } as CheckInState)).toContain('Code not recognised');
    expect(render({ phase: 'error', message: 'Service is down.' } as CheckInState)).toContain('Service is down.');
  });
  it('shows the person with an enabled check-in when they can be checked in', () => {
    const html = render({ phase: 'ready', card, method: 'qr' } as CheckInState);
    expect(html).toContain('Ada Lee');
    expect(html).toContain('>Check in</button>');
    expect(html).not.toContain('disabled=""');
  });
  it('disables the action while the check-in is being sent', () => {
    expect(render({ phase: 'submitting', card, method: 'qr' } as CheckInState)).toContain('Checking in…');
  });
  it('shows a refusal with a way to clear for the next person', () => {
    const html = render({ phase: 'refused', card, method: 'qr', refusal: { reason: 'archived' } } as unknown as CheckInState);
    expect(html).toContain('Clear and scan the next person');
  });
  it('confirms a check-in and says whether an override is on record', () => {
    const state = { phase: 'done', card, entry: { checkedInAt: '2027-07-03T09:00:00.000Z' }, overridden: true } as unknown as CheckInState;
    const html = render(state);
    expect(html).toContain('Ada Lee checked in');
    expect(html).toContain('with an override on record');
  });
});
