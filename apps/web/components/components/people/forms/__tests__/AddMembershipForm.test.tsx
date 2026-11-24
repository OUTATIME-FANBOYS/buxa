import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Session } from '@buxa/contracts';
import { AddMembershipForm } from '@/components/components/people/forms';
import { settle } from '@buxa/domain';

vi.mock('@buxa/server/composers/people/addMembershipAction', () => ({
  addMembershipAction: () => settle(() => ({ status: 'idle' })),
}));

const SESSION: Session = {
  id: '5a5a5a5a-5a5a-4a5a-8a5a-5a5a5a5a5a5a',
  name: 'Summer camp',
  description: '',
  startsOn: '2027-07-01',
  endsOn: '2027-08-30',
  classCount: 2,
  isPublic: false,
  archivedAt: null,
  createdAt: '2027-01-01T00:00:00.000Z',
};

describe('AddMembershipForm', () => {
  it('starts with a Session dropdown (no Name or dates until Custom is chosen) for the person', () => {
    const html = renderToStaticMarkup(
      <AddMembershipForm personId="p-1" sessions={[SESSION]} formId="add-membership-form" />,
    );
    expect(html).toMatch(/<label[^>]*>Session/);
    expect(html).toContain('name="sessionId"');
    expect(html).toContain('Choose a session');
    expect(html).toContain('>Custom<');
    expect(html).not.toMatch(/<label[^>]*>Name/);
    expect(html).not.toMatch(/<label[^>]*>Starts on/);
    expect(html).toContain('name="personId" value="p-1"');
    expect(html).toContain('id="add-membership-form"');
  });

  it('lists the sessions by name, and leaves out a session with no dates', () => {
    const html = renderToStaticMarkup(
      <AddMembershipForm
        personId="p-1"
        sessions={[SESSION, { ...SESSION, id: 'no-dates', name: 'Undated', startsOn: null, endsOn: null }]}
        formId="add-membership-form"
      />,
    );
    expect(html).toContain('>Summer camp<');
    expect(html).not.toContain('Undated');
  });

  it('uses the form frame of the pop-ups (no inline heading, no submit button of its own)', () => {
    const html = renderToStaticMarkup(<AddMembershipForm personId="p-1" sessions={[]} formId="add-membership-form" />);
    expect(html).not.toContain('Add a membership');
    expect(html).not.toContain('>Add membership</button>');
  });
});
