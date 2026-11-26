// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { CAMP_ROLES, settle, type CampRole } from '@buxa/domain';
import { idle, type HouseholdChoice } from '@buxa/shared';
import { PersonForm, type EditablePerson } from '@/components/components/people/forms';
import { UiProvider } from '@buxa/middleware/providers/UiProvider';
import { ConfirmDialog } from '@/components/components';
import { LEE, PERSON, formHelpers } from './personFormFixtures';

vi.mock('@buxa/server/composers/people/createPersonAction', () => ({
  createPersonAction: () => settle(() => idle),
}));
vi.mock('@buxa/server/composers/people/updatePersonAction', () => ({
  updatePersonAction: () => settle(() => idle),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('PersonForm: roles are checkboxes in both modes', () => {
  let root: Root;
  let host: HTMLDivElement;
  beforeEach(() => {
    host = document.body.appendChild(document.createElement('div'));
    root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  const renderAdd = (households: HouseholdChoice[] = []) =>
    act(() => {
      root.render(
        <UiProvider Dialog={ConfirmDialog}>
          <PersonForm mode="create" household={null} households={households} variant="dialog" formId="f" />
        </UiProvider>,
      );
    });
  const renderEdit = (person: EditablePerson) =>
    act(() => {
      root.render(
        <UiProvider Dialog={ConfirmDialog}>
          <PersonForm mode="edit" person={person} households={[]} variant="dialog" formId="f" />
        </UiProvider>,
      );
    });
  const h = formHelpers(() => host);
  const click = (value: CampRole) => act(() => h.role(value)?.click());

  it.each([
    ['add', () => renderAdd()],
    ['edit', () => renderEdit(PERSON)],
  ])('%s: offers every role as a checkbox, never a radio, under the Roles heading', (_mode, render) => {
    render();
    const inputs = Array.from(host.querySelectorAll<HTMLInputElement>('input[name="roles"]'));
    // The roles render in two groups (Family first), so compare as sets of values.
    expect(inputs.map(input => input.value).sort()).toEqual([...CAMP_ROLES].sort());
    expect(inputs.every(input => input.type === 'checkbox')).toBe(true);
    expect(h.legend('Roles *')).toBeDefined();
    expect(host.textContent).toContain('Choose everything that applies.');
    expect(host.textContent).not.toContain('Choose one.');
  });

  it('adding: a family role and one allowed extra can be chosen, and a checked role clears when clicked again', () => {
    renderAdd();
    click('camper');
    click('participant');
    expect(h.checkedRoles()).toEqual(['camper', 'participant']);
    click('camper');
    expect(h.checkedRoles()).toEqual(['participant']);
  });

  it('editing: every role the person has is checked, and another can be added', () => {
    renderEdit({ ...PERSON, roles: ['guardian'] });
    expect(h.checkedRoles()).toEqual(['guardian']);
    click('instructor');
    expect(h.checkedRoles()).toEqual(['guardian', 'instructor']);
  });

  it('the Family and Staff and participants groups are kept in both modes', () => {
    renderAdd();
    const headings = Array.from(host.querySelectorAll('h3')).map(el => el.textContent);
    expect(headings).toEqual(['Family', 'Staff and participants']);
    // The Family group comes first and holds the family roles, the camper among them.
    const [family] = Array.from(host.querySelectorAll('.person-role-group'));
    expect(family?.querySelector('.people-check')?.textContent).toBe('Parent or guardian');
    expect(family?.textContent).toContain('Camper');
  });
});

describe('PersonForm: one email field, and the roles that cannot be combined', () => {
  let root: Root;
  let host: HTMLDivElement;
  beforeEach(() => {
    host = document.body.appendChild(document.createElement('div'));
    root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  const renderAdd = () =>
    act(() => {
      root.render(
        <UiProvider Dialog={ConfirmDialog}>
          <PersonForm mode="create" household={null} households={[LEE]} variant="dialog" formId="f" />
        </UiProvider>,
      );
    });
  const renderEdit = (person: EditablePerson) =>
    act(() => {
      root.render(
        <UiProvider Dialog={ConfirmDialog}>
          <PersonForm mode="edit" person={person} households={[LEE]} variant="dialog" formId="f" />
        </UiProvider>,
      );
    });
  const h = formHelpers(() => host);
  const click = (value: CampRole) => act(() => h.role(value)?.click());
  const emailFields = () => host.querySelectorAll<HTMLInputElement>('input[name="email"]');
  const disabledRoles = () =>
    Array.from(host.querySelectorAll<HTMLInputElement>('input[name="roles"]'))
      .filter(input => input.disabled)
      .map(input => input.value);
  const inviteButton = () =>
    Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('invite'));

  it('nothing selected: one Email field, no Household', () => {
    renderAdd();
    expect(emailFields()).toHaveLength(1);
    expect(h.label('Email')).toBeDefined();
    expect(h.input('householdEmail')).toBeNull();
    expect(h.legend('Household')).toBeUndefined();
  });

  it('a family role: one field labelled Household email, with the Household section', () => {
    renderAdd();
    click('camper');
    expect(emailFields()).toHaveLength(1);
    expect(h.label('Household email')).toBeDefined();
    expect(h.legend('Household')).toBeDefined();
    expect(h.input('householdEmail')).toBeNull();
  });

  it('a staff or participant role: one field labelled Email, and no Household', () => {
    renderAdd();
    click('participant');
    expect(emailFields()).toHaveLength(1);
    expect(h.label('Email')).toBeDefined();
    expect(h.label('Household email')).toBeUndefined();
    expect(h.legend('Household')).toBeUndefined();
  });

  it('a family role and a staff role: still one field, labelled Household email', () => {
    renderAdd();
    click('guardian');
    click('instructor');
    expect(emailFields()).toHaveLength(1);
    expect(h.label('Household email')).toBeDefined();
  });

  it('the label switches back to Email when the family role is unticked', () => {
    renderAdd();
    click('camper');
    click('camper');
    expect(h.label('Household email')).toBeUndefined();
    expect(h.label('Email')).toBeDefined();
  });

  it('the Household email label still stores the same person email field', () => {
    renderEdit({ ...PERSON, roles: ['camper'], email: 'kid@example.com' });
    expect(emailFields()).toHaveLength(1);
    expect(emailFields()[0]?.value).toBe('kid@example.com');
  });

  it('the invite button is disabled with an empty email for an instructor', () => {
    renderAdd();
    click('instructor');
    expect(inviteButton()?.disabled).toBe(true);
  });

  it('for another role the invite button shows the coming-soon note and is disabled', () => {
    renderAdd();
    click('organizer');
    expect(inviteButton()?.disabled).toBe(true);
    expect(host.textContent).toContain('Invites for this role are coming soon.');
  });

  it('after one staff role is ticked, the other staff roles are disabled, with the reason shown', () => {
    renderAdd();
    click('instructor');
    // Guardian + Instructor is an allowed set, so Parent or guardian stays open.
    expect(disabledRoles().sort()).toEqual(['admin_staff', 'camper', 'organizer', 'participant']);
    expect(host.textContent).toContain("Some roles can't be combined.");
    expect(h.role('instructor')?.disabled).toBe(false);
  });

  it('Parent or guardian + Instructor: Organizer, Camper and Admin staff are disabled (no three-role set)', () => {
    renderAdd();
    click('guardian');
    click('instructor');
    expect(h.role('organizer')?.disabled).toBe(true);
    expect(h.role('camper')?.disabled).toBe(true);
    expect(h.role('admin_staff')?.disabled).toBe(true);
  });

  it('a saved set that is not allowed (legacy) shows the notice and blocks the save until it is fixed', () => {
    renderEdit({ ...PERSON, roles: ['instructor', 'organizer'] });
    expect(host.textContent).toContain("This person's roles don't match the rules. Change them to save.");
    const form = host.querySelector('form');
    const submit = new Event('submit', { cancelable: true, bubbles: true });
    act(() => {
      form?.dispatchEvent(submit);
    });
    expect(submit.defaultPrevented).toBe(true);
    // Nothing is disabled while the set is not allowed, so the person can untick one to fix it.
    expect(disabledRoles()).toEqual([]);
    click('organizer');
    expect(host.textContent).not.toContain("This person's roles don't match the rules.");
    expect(h.checkedRoles()).toEqual(['instructor']);
  });
});
