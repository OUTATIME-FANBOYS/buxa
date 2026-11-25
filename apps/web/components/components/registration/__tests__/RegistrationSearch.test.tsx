import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { RegistrationForm, RegistrationRow } from '@buxa/contracts';

vi.mock('@/actions/registration', () => ({
  confirmRegistrationAction: vi.fn(),
  recordPaymentAction: vi.fn(),
  withdrawRegistrationAction: vi.fn(),
  archiveRegistrationAction: vi.fn(),
  unarchiveRegistrationAction: vi.fn(),
  deleteRegistrationAction: vi.fn(),
}));

import { RegistrationSearch } from '@/components/components/registration/RegistrationSearch';
import { registrationSearchRows } from '@/components/components/registration/registrationSearchRows';

const form = { id: 'form-1', name: 'Season form' } as RegistrationForm;

const row = (id: string, over: Partial<RegistrationRow> = {}): RegistrationRow => ({
  id,
  formVersion: 1,
  submittedAt: '2027-06-01T00:00:00.000Z',
  status: 'pending',
  confirmedAt: null,
  withdrawnAt: null,
  archivedAt: null,
  standard: { camperFirstName: 'Ada', camperLastName: 'Lovelace' },
  custom: {},
  documents: [],
  sessions: [{ sessionId: 'summer', sessionName: 'Summer camp', status: 'submitted' }],
  classes: [],
  ...over,
});

const render = (rows: RegistrationRow[], canDelete = false) =>
  renderToStaticMarkup(<RegistrationSearch rows={registrationSearchRows([{ form, rows }])} canDelete={canDelete} />);

describe('registrationSearchRows', () => {
  it('carries the registration, its form and whether it is archived, so the list can act on it', () => {
    const [flat] = registrationSearchRows([
      { form, rows: [row('reg-1', { archivedAt: '2027-06-02T00:00:00.000Z', status: 'withdrawn' })] },
    ]);
    expect(flat).toMatchObject({ registrationId: 'reg-1', formId: 'form-1', archived: true, status: 'withdrawn' });
  });
});

describe('RegistrationSearch (the main registration list)', () => {
  it('shows each registration with Withdraw and Archive, and Delete only for an admin or the owner', () => {
    const staff = render([row('reg-1')]);
    expect(staff).toContain('Withdraw');
    expect(staff).toContain('Archive');
    expect(staff).not.toContain('>Delete<');
    expect(render([row('reg-1')], true)).toContain('>Delete<');
  });

  it('shows a withdrawn registration as Withdrawn', () => {
    const html = render([row('reg-1', { status: 'withdrawn', withdrawnAt: '2027-06-02T00:00:00.000Z' })]);
    expect(html).toContain('Withdrawn');
    expect(html).not.toContain('>Withdraw<');
  });

  it('hides an archived registration until archived ones are asked for', () => {
    const html = render([row('reg-1'), row('reg-2', { archivedAt: '2027-06-02T00:00:00.000Z' })]);
    expect(html).toContain('Show archived registrations');
    expect(html.match(/Ada Lovelace/g)).toHaveLength(1);
  });

  it('says when every registration is archived', () => {
    const html = render([row('reg-1', { archivedAt: '2027-06-02T00:00:00.000Z' })]);
    expect(html).toContain('No registrations to show');
  });
});
