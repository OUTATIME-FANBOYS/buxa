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
  documents: [],
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
  it('offers Withdraw and Archive to staff as icon buttons named for the camper, and Delete only when the person may delete', () => {
    const staffHtml = render([row('pending', 'reg-1')]);
    expect(staffHtml).toContain('aria-label="Withdraw Ada Lovelace"');
    expect(staffHtml).toContain('aria-label="Archive Ada Lovelace"');
    expect(staffHtml).not.toContain('aria-label="Delete Ada Lovelace"');

    const adminHtml = render([row('pending', 'reg-1')], true);
    expect(adminHtml).toContain('aria-label="Delete Ada Lovelace"');
  });

  it('gives each icon action a tooltip and shows no text label for it', () => {
    const html = render([row('pending', 'reg-1')], true);
    expect(html).toContain('title="Withdraw registration"');
    expect(html).toContain('title="Archive registration"');
    expect(html).toContain('title="Delete registration"');
    expect(html).not.toContain('>Withdraw<');
    expect(html).not.toContain('>Archive<');
    expect(html).not.toContain('>Delete<');
  });

  it('keeps the row action Confirm as a labelled button, and no other button in the row is labelled', () => {
    const html = render([row('pending', 'reg-1')], true);
    expect(html).toContain('>Confirm</button>');
    expect(html).not.toContain('>Withdraw</button>');
    expect(html).not.toContain('>Archive</button>');
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

const heldPlace = {
  id: 'rc-1',
  classId: 'class-1',
  className: 'Art',
  sessionId: SESSION.id,
  sessionName: SESSION.name,
  camperId: 'camper-1',
  camperName: 'Ada Lovelace',
  status: 'held',
  paymentStatus: 'unpaid',
  paymentNote: null,
  price: { amountMinor: 12000, currency: 'USD', earlyBird: false },
} as const;

describe('SubmissionsBySession places and payment', () => {
  it('puts the places line, the Held and Unpaid pills and the price on one line', () => {
    const html = render([row('pending', 'reg-1', { classes: [heldPlace] })]);
    const line = html.match(/<div class="registration-place__line">[\s\S]*?<\/div>/)?.[0] ?? '';

    expect(line).toContain('Ada Lovelace, Art');
    expect(line).toContain('Held');
    expect(line).toContain('Unpaid');
    expect(line).toContain('120');
  });

  it('puts the "How it was paid" box and the Mark paid button in the same payment row', () => {
    const html = render([row('pending', 'reg-1', { classes: [heldPlace] })]);
    const payment = html.match(/<form[^>]*class="registration-payment"[\s\S]*?<\/form>/)?.[0] ?? '';

    expect(payment).toContain('registration-payment__note');
    expect(payment).toContain('How it was paid');
    expect(payment).toContain('>Mark paid</button>');
  });

  it('keeps the Answers disclosure with its version in its summary', () => {
    const html = render([row('pending', 'reg-1')]);

    expect(html).toContain('class="registration-disclosure"');
    expect(html).toContain('<summary>Answers, version 1</summary>');
  });
});
