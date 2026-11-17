import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { OnSiteRowView } from '@buxa/shared';
import { OnSiteRow } from '../OnSiteRow';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {}, push() {} }) }));
vi.mock('@/logic/composers/attendance/checkOut', () => ({ checkOutAction: async () => ({ kind: 'ok', value: {} }) }));

const row = { personId: 'p-1', name: 'Mia Cole', arrivedAt: '09:05', isMinor: true } as unknown as OnSiteRowView;

describe('OnSiteRow', () => {
  it('names the person, marks a minor and shows the arrival time', () => {
    const html = renderToStaticMarkup(<OnSiteRow row={row} canRecord={false} canOverride={false} />);
    expect(html).toContain('<span class="onsite-name">Mia Cole</span>');
    expect(html).toContain('Minor');
    expect(html).toContain('Arrived 09:05');
    expect(html).not.toContain('Check out');
  });
  it('offers a check-out control to staff who can record it', () => {
    const html = renderToStaticMarkup(<OnSiteRow row={row} canRecord canOverride={false} />);
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('>Check out</button>');
  });
});
