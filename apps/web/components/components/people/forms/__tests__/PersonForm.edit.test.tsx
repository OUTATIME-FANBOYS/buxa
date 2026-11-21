import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CAMP_ROLES, settle } from '@buxa/domain';
import { idle } from '@buxa/shared';
import { PersonForm, type EditablePerson } from '@/components/components/people/forms';
import { UiProvider } from '@buxa/middleware/providers/UiProvider';
import { Dialog as ConfirmDialog } from '@/components/components';

/** The form's invite button reads the UI provider, so every render sits inside one, as the app does. */
const inUi = (form: ReactElement) => renderToStaticMarkup(<UiProvider Dialog={ConfirmDialog}>{form}</UiProvider>);

vi.mock('@buxa/server/composers/people/updatePersonAction', () => ({
  updatePersonAction: () => settle(() => idle),
}));
vi.mock('@buxa/server/composers/people/createPersonAction', () => ({
  createPersonAction: () => settle(() => idle),
}));

const person: EditablePerson = {
  id: 'p-1',
  givenName: 'Ada',
  familyName: 'Lee',
  preferredName: 'Annie',
  roles: ['participant'],
  dateOfBirth: '2016-05-02',
  email: 'ada@example.com',
  phone: '0400 000 000',
  households: [],
};

/** The checked role inputs, in either attribute order (React does not promise an order). */
const checkedRoles = (html: string) =>
  Array.from(html.matchAll(/<input[^>]*>/g))
    .map(match => match[0])
    .filter(tag => tag.includes('name="roles"') && tag.includes('checked=""'))
    .map(tag => /value="([^"]+)"/.exec(tag)?.[1]);

describe('PersonForm (edit): the Edit person pop-up and page', () => {
  it('pre-fills every field from the person', () => {
    const html = inUi(<PersonForm mode="edit" households={[]} person={person} variant="dialog" />);
    expect(html).toContain('name="givenName" value="Ada"');
    expect(html).toContain('name="familyName" value="Lee"');
    expect(html).toContain('name="preferredName" value="Annie"');
    expect(html).toContain('value="2016-05-02"');
    expect(html).toContain('name="phone" value="0400 000 000"');
    expect(html).toContain('name="email" value="ada@example.com"');
    expect(html).toContain('name="id" value="p-1"');
  });

  it('ticks every role the person has, and only those', () => {
    const multi: EditablePerson = { ...person, roles: ['guardian', 'instructor'] };
    const html = inUi(<PersonForm mode="edit" households={[]} person={multi} variant="dialog" />);
    expect(checkedRoles(html)).toEqual(['guardian', 'instructor']);
    expect(html.match(/name="roles"/g)).toHaveLength(CAMP_ROLES.length);
  });

  it('shows one Household email field for a family role, with the Household section', () => {
    const html = inUi(
      <PersonForm mode="edit" households={[]} person={{ ...person, roles: ['camper'] }} variant="dialog" />,
    );
    expect(html).toContain('>Household</legend>');
    expect(html).toContain('>Household email</label>');
    expect(html.match(/name="email"/g)).toHaveLength(1);
    expect(html).not.toContain('name="householdEmail"');
  });

  it('shows one Email field and no Household for a staff or participant role', () => {
    const html = inUi(<PersonForm mode="edit" households={[]} person={person} variant="dialog" />);
    expect(html.match(/name="email"/g)).toHaveLength(1);
    expect(html).toContain('>Email</label>');
    expect(html).not.toContain('>Household</legend>');
  });

  it('offers Resend invite beside Email for an instructor, and the coming-soon note for another role', () => {
    const teacher = inUi(
      <PersonForm mode="edit" households={[]} person={{ ...person, roles: ['instructor'] }} variant="dialog" />,
    );
    expect(teacher).toContain('Resend invite');
    expect(teacher).not.toContain('Invites for this role are coming soon.');

    const other = inUi(<PersonForm mode="edit" households={[]} person={person} variant="dialog" />);
    expect(other).toContain('Invites for this role are coming soon.');
    expect(other).toContain('Resend invite');
  });

  it('Resend invite waits for a valid email: disabled when the email is empty, enabled when it is valid', () => {
    const teacher = { ...person, roles: ['instructor' as const] };
    const inviteButton = (html: string) =>
      /<button[^>]*>(?:(?!<\/button>)[\s\S])*?Resend invite<\/button>/.exec(html)?.[0] ?? '';
    const empty = inUi(
      <PersonForm mode="edit" households={[]} person={{ ...teacher, email: null }} variant="dialog" />,
    );
    expect(inviteButton(empty)).toContain('disabled=""');
    const valid = inUi(<PersonForm mode="edit" households={[]} person={teacher} variant="dialog" />);
    expect(inviteButton(valid)).not.toContain('disabled=""');
    expect(inviteButton(valid)).toContain('Resend invite');
  });

  it('on its own page it keeps the panel, Save changes and Cancel back to the person', () => {
    const html = inUi(<PersonForm mode="edit" households={[]} person={person} />);
    expect(html).toContain('panel people-form person-form');
    expect(html).toContain('>Save changes</button>');
    expect(html).toContain('href="/camp/people/p-1"');
  });

  it('in the pop-up it has no footer of its own and posts dialog=1 so a save does not redirect', () => {
    const html = inUi(<PersonForm mode="edit" households={[]} person={person} variant="dialog" formId="f" />);
    expect(html).not.toContain('Save changes');
    expect(html).toContain('name="dialog" value="1"');
    expect(html).toContain('id="f"');
  });
});

describe('PersonForm: one component for both modes', () => {
  it('renders the same form element, with the same fields, for add and edit', () => {
    const add = inUi(<PersonForm mode="create" household={null} households={[]} variant="dialog" formId="f" />);
    const edit = inUi(<PersonForm mode="edit" households={[]} person={person} variant="dialog" formId="f" />);
    for (const html of [add, edit]) {
      expect(html).toContain('class="people-form person-form"');
      expect(html).toContain('name="givenName"');
      expect(html).toContain('name="familyName"');
      expect(html).toContain('name="dateOfBirth"');
      expect(html).toContain('name="phone"');
    }
  });

  it('uses checkboxes for roles in both modes, so a person can hold several', () => {
    const add = inUi(<PersonForm mode="create" household={null} households={[]} variant="dialog" />);
    const edit = inUi(<PersonForm mode="edit" households={[]} person={person} variant="dialog" />);
    for (const html of [add, edit]) {
      expect(html).toContain('type="checkbox"');
      expect(html).not.toContain('type="radio"');
    }
  });
});
