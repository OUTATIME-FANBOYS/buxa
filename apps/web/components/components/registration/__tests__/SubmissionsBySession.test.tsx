import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { RegistrationRow } from '@buxa/contracts';

vi.mock('@/actions/registration', () => ({ confirmRegistrationAction: vi.fn(), recordPaymentAction: vi.fn() }));

import { SubmissionsBySession } from '@/components/components/registration/SubmissionsBySession';

const SESSION = { id: 'session-1', name: 'Week 1' };

const row = (status: 'pending' | 'confirmed', id: string): RegistrationRow => ({
  id,
  formVersion: 1,
  submittedAt: '2027-06-01T10:00:00.000Z',
  status,
  confirmedAt: status === 'confirmed' ? '2027-06-02T10:00:00.000Z' : null,
  standard: { camperFirstName: 'Ada', camperLastName: 'Lovelace', guardianPhone: '555-0100' },
  custom: {},
  sessions: [{ sessionId: SESSION.id, sessionName: SESSION.name, status: 'submitted' }],
  classes: [],
});

function render(submissions: RegistrationRow[]) {
  return renderToStaticMarkup(
    <SubmissionsBySession formId="form-1" sessions={[SESSION]} fields={[]} submissions={submissions} />,
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
