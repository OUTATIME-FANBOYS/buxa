import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Enrolment } from '@buxa/contracts';
import { EnrolmentTable } from '../EnrolmentTable';

vi.mock('../../actions', () => ({ cancelEnrolmentAction: vi.fn() }));

const CLASS_ID = '11111111-1111-4111-8111-111111111111';

const enrolment = (over: Partial<Enrolment> = {}): Enrolment => ({
  id: '33333333-3333-4333-8333-333333333333', sessionId: '22222222-2222-4222-8222-222222222222', classId: CLASS_ID,
  className: 'Robotics', camperId: '44444444-4444-4444-8444-444444444444', camperName: 'Ada Lovelace',
  status: 'enrolled', enrolledAt: '2027-07-01T00:00:00.000Z', overrideReason: null, ...over,
});

describe('EnrolmentTable', () => {
  it('lists each camper by name and status, with no contact details', () => {
    const html = renderToStaticMarkup(<EnrolmentTable classId={CLASS_ID} enrolments={[enrolment()]} canManage timeZone="Australia/Sydney" />);
    expect(html).toContain('Ada Lovelace');
    expect(html).toContain('Enrolled');
    expect(html).not.toMatch(/@|phone|email/i);
  });

  it('offers cancel to staff, naming the camper on the button', () => {
    const html = renderToStaticMarkup(<EnrolmentTable classId={CLASS_ID} enrolments={[enrolment()]} canManage timeZone="Australia/Sydney" />);
    expect(html).toContain('Cancel enrolment');
    expect(html).toContain('for Ada Lovelace');
  });

  it('shows no cancel button and no actions column to a viewer', () => {
    const html = renderToStaticMarkup(<EnrolmentTable classId={CLASS_ID} enrolments={[enrolment()]} canManage={false} timeZone="Australia/Sydney" />);
    expect(html).not.toContain('Cancel enrolment');
    expect(html).not.toContain('Actions');
  });

  it('does not offer to cancel an enrolment that is already cancelled', () => {
    const html = renderToStaticMarkup(<EnrolmentTable classId={CLASS_ID} enrolments={[enrolment({ status: 'cancelled' })]} canManage timeZone="Australia/Sydney" />);
    expect(html).toContain('Cancelled');
    expect(html).not.toContain('Cancel enrolment');
  });
});
