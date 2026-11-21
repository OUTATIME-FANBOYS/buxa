// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { PersonForm } from '@/components/components/people/forms';
import { UiProvider } from '@buxa/middleware/providers/UiProvider';
import { Dialog as ConfirmDialog } from '@/components/components';
import { settle } from '@buxa/domain';
import { ADD_PERSON_INTRO, type HouseholdChoice } from '@buxa/shared';

vi.mock('@buxa/server/composers/people/createPersonAction', () => ({
  createPersonAction: () => settle(() => ({ status: 'idle' })),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const LEE: HouseholdChoice = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Lee family',
  hasGuardian: true,
};

describe('PersonForm (create): one role at a time, and which sections show for it', () => {
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

  const render = (household: { id: string; name: string } | null = null, households: HouseholdChoice[] = []) =>
    act(() => {
      root.render(
        <UiProvider Dialog={ConfirmDialog}>
          <PersonForm
            mode="create"
            household={household}
            households={households}
            variant="dialog"
            formId="new-person-form"
          />
        </UiProvider>,
      );
    });
  const radio = (value: string) => host.querySelector<HTMLInputElement>(`input[name="roles"][value="${value}"]`);
  const click = (value: string) => act(() => radio(value)?.click());
  const checkedRoles = () =>
    Array.from(host.querySelectorAll<HTMLInputElement>('input[name="roles"]'))
      .filter(input => input.checked)
      .map(input => input.value);
  const householdLegend = () =>
    Array.from(host.querySelectorAll('legend')).find(l => l.textContent?.trim() === 'Household');
  const personalEmail = () => host.querySelector('input[name="email"]');
  const householdEmail = () => host.querySelector('input[name="householdEmail"]');
  const relationship = () => host.querySelector('input[name="relationship"]');
  const existingHousehold = () => host.querySelector('select[name="householdId"]');

  it('offers the six roles as single-choice radios, not checkboxes', () => {
    render();
    const inputs = Array.from(host.querySelectorAll<HTMLInputElement>('input[name="roles"]'));
    expect(inputs.map(input => input.value)).toEqual([
      'camper',
      'guardian',
      'participant',
      'instructor',
      'organizer',
      'admin_staff',
    ]);
    expect(inputs.every(input => input.type === 'radio')).toBe(true);
  });

  it('selecting a role selects only that one: choosing another clears the first', () => {
    render();
    click('camper');
    expect(checkedRoles()).toEqual(['camper']);
    click('instructor');
    expect(checkedRoles()).toEqual(['instructor']);
  });

  it('selecting the chosen role again clears it, so no role is selected', () => {
    render();
    click('camper');
    click('camper');
    expect(checkedRoles()).toEqual([]);
  });

  it('shows no Household section and no Email until a role is chosen', () => {
    render();
    expect(householdLegend()).toBeUndefined();
    expect(personalEmail()).toBeNull();
  });

  it('shows the person’s own Email once a role other than camper or guardian is chosen', () => {
    render();
    click('instructor');
    expect(personalEmail()).not.toBeNull();
    expect(householdLegend()).toBeUndefined();
  });

  it('shows Household, with a relationship and a household email, for a camper, and no own Email', () => {
    render();
    click('camper');
    expect(householdLegend()).toBeDefined();
    expect(relationship()).not.toBeNull();
    expect(householdEmail()).not.toBeNull();
    expect(personalEmail()).toBeNull();
  });

  it('shows Household for a parent or guardian, without a relationship, with the email under Household', () => {
    render();
    click('guardian');
    expect(householdLegend()).toBeDefined();
    expect(relationship()).toBeNull();
    expect(householdEmail()).not.toBeNull();
    expect(personalEmail()).toBeNull();
  });

  it('hides Household and the email again when the role is cleared', () => {
    render();
    click('camper');
    click('camper');
    expect(householdLegend()).toBeUndefined();
    expect(householdEmail()).toBeNull();
    expect(personalEmail()).toBeNull();
  });

  it('moves from a family role to another role: Household goes, and the own Email appears', () => {
    render();
    click('guardian');
    click('participant');
    expect(householdLegend()).toBeUndefined();
    expect(personalEmail()).not.toBeNull();
  });

  it('shows the intro line only inside the Household section', () => {
    render();
    expect(host.textContent).not.toContain(ADD_PERSON_INTRO);
    click('camper');
    expect(householdLegend()).toBeDefined();
    expect(host.textContent).toContain(ADD_PERSON_INTRO);
  });

  it('offers the existing households once a family role is chosen', () => {
    render(null, [LEE]);
    click('guardian');
    expect(existingHousehold()).not.toBeNull();
    expect(host.querySelector(`option[value="${LEE.id}"]`)).not.toBeNull();
  });

  it('says which household the person joins when they come from a guardian page', () => {
    render({ id: LEE.id, name: 'Lee family' }, []);
    click('camper');
    expect(host.textContent).toContain('Lee family');
    expect(existingHousehold()).toBeNull();
  });
});
