// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { CAMP_ROLES, settle, type CampRole } from '@buxa/domain';
import { ADD_PERSON_INTRO, idle, type HouseholdChoice } from '@buxa/shared';
import { PersonForm, type EditablePerson } from '@/components/components/people/forms';
import { UiProvider } from '@buxa/middleware/providers/UiProvider';
import { Dialog as ConfirmDialog } from '@/components/components';
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

  it('adding: several roles can be chosen at once, and a checked role clears when clicked again', () => {
    renderAdd();
    click('camper');
    click('instructor');
    expect(h.checkedRoles()).toEqual(['camper', 'instructor']);
    click('camper');
    expect(h.checkedRoles()).toEqual(['instructor']);
  });

  it('editing: every role the person has is checked, and another can be added', () => {
    renderEdit({ ...PERSON, roles: ['guardian', 'instructor'] });
    expect(h.checkedRoles()).toEqual(['guardian', 'instructor']);
    click('organizer');
    expect(h.checkedRoles()).toEqual(['guardian', 'instructor', 'organizer']);
  });

  it('the Family and Staff and participants groups are kept in both modes', () => {
    renderAdd();
    const headings = Array.from(host.querySelectorAll('h3')).map(el => el.textContent);
    expect(headings).toEqual(['Family', 'Staff and participants']);
    expect(host.querySelector('.people-check')?.textContent).toBe('Camper');
  });
});

describe('PersonForm: which email fields show depends on the roles', () => {
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

  it('nothing selected: neither Email nor Household', () => {
    renderAdd();
    expect(h.input('email')).toBeNull();
    expect(h.input('householdEmail')).toBeNull();
    expect(h.legend('Household')).toBeUndefined();
  });

  it('a family role only (Camper): Household email, Household, and no Email', () => {
    renderAdd();
    click('camper');
    expect(h.legend('Household')).toBeDefined();
    expect(host.textContent).toContain(ADD_PERSON_INTRO);
    expect(h.select('householdId')).not.toBeNull();
    expect(h.input('newHouseholdName')).not.toBeNull();
    expect(h.input('householdEmail')).not.toBeNull();
    expect(h.label('Household email')).toBeDefined();
    expect(h.input('email')).toBeNull();
    expect(host.textContent).not.toContain('Kept with the household.');
  });

  it('a parent or guardian: Household email and no Email, and no relationship', () => {
    renderAdd();
    click('guardian');
    expect(h.input('householdEmail')).not.toBeNull();
    expect(h.input('email')).toBeNull();
    expect(h.input('relationship')).toBeNull();
  });

  it('a staff or participant role only: Email and no Household', () => {
    renderAdd();
    click('participant');
    expect(h.input('email')).not.toBeNull();
    expect(h.label('Email')).toBeDefined();
    expect(h.legend('Household')).toBeUndefined();
    expect(h.input('householdEmail')).toBeNull();
  });

  it('a family role and a staff role: Household email and Email, each with its own label', () => {
    renderAdd();
    click('guardian');
    click('instructor');
    expect(h.input('householdEmail')).not.toBeNull();
    expect(h.input('email')).not.toBeNull();
    expect(h.label('Household email')).toBeDefined();
    expect(h.label('Email')).toBeDefined();
  });

  it('a family role is dropped: the Household email goes and the Email comes back for a staff role', () => {
    renderAdd();
    click('camper');
    click('instructor');
    click('camper');
    expect(h.input('householdEmail')).toBeNull();
    expect(h.input('email')).not.toBeNull();
  });

  it('editing a camper: Household email, no Email', () => {
    renderEdit({ ...PERSON, roles: ['camper'] });
    expect(h.input('householdEmail')).not.toBeNull();
    expect(h.input('email')).toBeNull();
    expect(h.legend('Household')).toBeDefined();
  });

  it('editing a participant: Email, no Household; a role change shows the Household', () => {
    renderEdit({ ...PERSON, roles: ['participant'] });
    expect(h.input('email')).not.toBeNull();
    expect(h.legend('Household')).toBeUndefined();
    click('guardian');
    expect(h.legend('Household')).toBeDefined();
    expect(h.input('householdEmail')).not.toBeNull();
  });
});
