import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { OnSiteRowView } from '../lib/onSiteView';
import { EMPTY_DRAFT } from './checkOutState';
import { CheckOutPanel, type CheckOutPanelProps } from './CheckOutPanel';

const row = (overrides: Partial<OnSiteRowView>): OnSiteRowView => ({
  personId: '6f1c2b8e-9a3d-4c5e-8f70-1a2b3c4d5e6f', name: 'Ada Lovelace', arrivedAt: '02:00', isMinor: true, pickupOptions: [], ...overrides,
});

const panel = (props: Partial<CheckOutPanelProps> & { row: OnSiteRowView }) => renderToStaticMarkup(
  <CheckOutPanel id="checkout-test" draft={EMPTY_DRAFT} busy={false} canOverride={false} refusal={null} failure={null}
    onPatch={() => {}} onSubmit={() => {}} {...props} />,
);

const NO_GUARDIAN_LINE = 'No guardian who may collect this child is linked yet.';

describe('CheckOutPanel guardian wording', () => {
  it('says there is no guardian once, when no refusal is showing', () => {
    const html = panel({ row: row({ isMinor: true }) });
    expect(html).toContain(NO_GUARDIAN_LINE);
  });

  it('shows the refusal notice instead of the static line, so the same thing is not said twice', () => {
    const html = panel({
      row: row({ isMinor: true }),
      refusal: { ok: false, reason: 'pickup_required', guardians: [], canOverride: false },
    });
    expect(html).not.toContain(NO_GUARDIAN_LINE);
    expect(html).toContain('No guardian to collect');
  });

  it('for an unknown minor status it neither requires a guardian nor claims there is none', () => {
    const html = panel({ row: row({ isMinor: null }) });
    expect(html).not.toContain(NO_GUARDIAN_LINE);
    expect(html).not.toContain('Who is collecting?');
    expect(html).toMatch(/<button type="submit"[^>]*>Check out<\/button>/);
    expect(html).not.toMatch(/<button type="submit"[^>]*disabled[^>]*>/);
  });

  it('for an unknown minor status it still lists guardians when there are some', () => {
    const html = panel({ row: row({ isMinor: null, pickupOptions: [{ personId: 'g1', name: 'Sam Lee', relationship: 'Parent' }] }) });
    expect(html).toContain('Who is collecting?');
  });

  it('an adult with nobody chosen can check out', () => {
    const html = panel({ row: row({ isMinor: false }) });
    expect(html).not.toMatch(/<button type="submit"[^>]*disabled[^>]*>/);
  });
});
