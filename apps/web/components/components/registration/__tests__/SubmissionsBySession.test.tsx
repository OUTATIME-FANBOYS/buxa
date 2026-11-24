import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { RegistrationRow } from '@buxa/contracts';

vi.mock('@/actions/registration', () => ({
  confirmRegistrationAction: vi.fn(),
  recordPaymentAction: vi.fn(),
  withdrawRegistrationAction: vi.fn(),
  archiveRegistrationAction: vi.fn(),
  unarchiveRegistrationAction: vi.fn(),
  deleteRegistrationAction: vi.fn(),
}));

import { SubmissionsBySession } from '@/components/components/registration/SubmissionsBySession';

const SESSION = { id: 'session-1', name: 'Week 1' };

const row = (
  status: 'pending' | 'confirmed' | 'withdrawn',
  id: string,
  over: Partial<RegistrationRow> = {},
): RegistrationRow => ({
  id,
  formVersion: 1,
  submittedAt: '2027-06-01T10:00:00.000Z',
  status,
  confirmedAt: status === 'confirmed' ? '2027-06-02T10:00:00.000Z' : null,
  withdrawnAt: null,
  archivedAt: null,
  standard: { camperFirstName: 'Ada', camperLastName: 'Lovelace', guardianPhone: '555-0100' },
  custom: {},
  sessions: [{ sessionId: SESSION.id, sessionName: SESSION.name, status: 'submitted' }],
  classes: [],
  ...over,
});

function render(submissions: RegistrationRow[], canDelete = false) {
  return renderToStaticMarkup(
    <SubmissionsBySession
      formId="form-1"
      sessions={[SESSION]}
      fields={[]}
      submissions={submissions}
      canDelete={canDelete}
    />,
  );
}

describe('SubmissionsBySession status and confirmation', () => {
  it('shows a pending registration as pending, with a Confirm action', () => {
    const html = render([row('pending', 'reg-1')]);
    expect(html).toContain('Pending');
    expect(html).toContain('Confirm');
  });

  it('shows a confirmed registration as confirmed, with no Confirm action', () => {
    const html = render([row('confirmed', 'reg-2')]);
    expect(html).toContain('Confirmed');
    expect(html).not.toContain('>Confirm<');
  });
});

describe('SubmissionsBySession registration lifecycle', () => {
  it('offers Withdraw and Archive to staff, and Delete only when the person may delete', () => {
    const staffHtml = render([row('pending', 'reg-1')]);
    expect(staffHtml).toContain('Withdraw');
    expect(staffHtml).toContain('Archive');
    expect(staffHtml).not.toContain('Delete');

    const adminHtml = render([row('pending', 'reg-1')], true);
    expect(adminHtml).toContain('Delete');
  });

  it('shows a withdrawn registration as withdrawn, with no Confirm and no Withdraw', () => {
    const html = render([row('withdrawn', 'reg-3', { withdrawnAt: '2027-06-03T10:00:00.000Z' })]);
    expect(html).toContain('Withdrawn');
    expect(html).not.toContain('Confirm</button>');
    expect(html).not.toContain('>Withdraw<');
  });

  it('moves an archived registration out of the table into an Archived list, where it can be unarchived', () => {
    const html = render([
      row('pending', 'reg-1'),
      row('confirmed', 'reg-2', { archivedAt: '2027-06-04T10:00:00.000Z' }),
    ]);
    expect(html).toContain('Archived registrations (1)');
    expect(html).toContain('Unarchive');
    // The count in the heading is for the registrations that are not archived.
    expect(html).toMatch(/Week 1 <span class="muted">1<\/span>/);
  });
});
