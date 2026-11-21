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
  const renderEdit = (person: EditablePerson, households: HouseholdChoice[] = []) =>
    act(() => {
      root.render(
        <UiProvider Dialog={ConfirmDialog}>
          <PersonForm mode="edit" person={person} households={households} variant="dialog" formId="f" />
        </UiProvider>,
      );
    });
  const h = formHelpers(() => host);
  const click = (value: CampRole) => act(() => h.role(value)?.click());

  it.each([
    ['add', renderAdd],
    ['edit', (): void => renderEdit(PERSON)],
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

  it('adding: several roles can be chosen at once, and a chosen role clears when clicked again', () => {
    renderAdd();
    click('camper');
    click('instructor');
    expect(h.checkedRoles()).toEqual(['camper', 'instructor']);
    click('camper');
    expect(h.checkedRoles()).toEqual(['instructor']);
  });

  it('editing: a person keeps the roles they have and can take on another', () => {
    renderEdit({ ...PERSON, roles: ['instructor', 'participant'] });
    expect(h.checkedRoles()).toEqual(['participant', 'instructor']);
    click('organizer');
    expect(h.checkedRoles()).toEqual(['participant', 'instructor', 'organizer']);
  });

  it('the Family and Staff and participants groups are kept in both modes', () => {
    renderAdd();
    const headings = Array.from(host.querySelectorAll('h3')).map(el => el.textContent);
    expect(headings).toEqual(['Family', 'Staff and participants']);
    expect(host.querySelector('.people-check')?.textContent).toBe('Camper');
  });
});

describe('PersonForm: the Household section shows for a family role in both modes', () => {
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

  it('adding: no Household section until a family role is chosen', () => {
    renderAdd();
    expect(h.legend('Household')).toBeUndefined();
    click('instructor');
    expect(h.legend('Household')).toBeUndefined();
  });

  it('adding a camper: Household with the existing and new household fields, the relationship and Household email', () => {
    renderAdd();
    click('camper');
    expect(h.legend('Household')).toBeDefined();
    expect(host.textContent).toContain(ADD_PERSON_INTRO);
    expect(h.select('householdId')).not.toBeNull();
    expect(h.input('newHouseholdName')).not.toBeNull();
    expect(h.input('relationship')).not.toBeNull();
    expect(h.input('householdEmail')).not.toBeNull();
    expect(h.label('Household email')).toBeDefined();
    expect(host.textContent).not.toContain('Kept with the household.');
  });

  it('adding a parent or guardian: the Household section and Household email, without the relationship', () => {
    renderAdd();
    click('guardian');
    expect(h.legend('Household')).toBeDefined();
    expect(h.input('householdEmail')).not.toBeNull();
    expect(h.input('relationship')).toBeNull();
    expect(h.label('Household email')).toBeDefined();
  });

  it('editing: the Household section shows for a family role the person already has', () => {
    renderEdit({ ...PERSON, roles: ['guardian'] });
    expect(h.legend('Household')).toBeDefined();
    expect(h.select('householdId')).not.toBeNull();
    expect(h.input('newHouseholdName')).not.toBeNull();
    expect(h.input('householdEmail')).not.toBeNull();
    expect(h.label('Household email')).toBeDefined();
  });

  it('editing: a role change shows and hides the section', () => {
    renderEdit({ ...PERSON, roles: ['instructor'] });
    expect(h.legend('Household')).toBeUndefined();
    click('camper');
    expect(h.legend('Household')).toBeDefined();
    click('camper');
    expect(h.legend('Household')).toBeUndefined();
  });
});
