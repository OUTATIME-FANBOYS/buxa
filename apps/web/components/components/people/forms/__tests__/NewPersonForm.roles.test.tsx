// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NewPersonForm } from '@/components/components/people/forms';
import { settle } from '@buxa/domain';
import type { HouseholdChoice } from '@buxa/shared';

vi.mock('@buxa/server/composers/people/createPersonAction', () => ({
  createPersonAction: () => settle(() => ({ status: 'idle' })),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const LEE: HouseholdChoice = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Lee family',
  hasGuardian: true,
};

describe('NewPersonForm: which sections show for which roles', () => {
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
        <NewPersonForm household={household} households={households} variant="dialog" formId="new-person-form" />,
      );
    });
  const role = (value: string) => host.querySelector<HTMLInputElement>(`input[name="roles"][value="${value}"]`);
  const toggle = (value: string) => act(() => role(value)?.click());
  const householdLegend = () =>
    Array.from(host.querySelectorAll('legend')).find(l => l.textContent?.trim() === 'Household');
  const personalEmail = () => host.querySelector('input[name="email"]');
  const householdEmail = () => host.querySelector('input[name="householdEmail"]');
  const relationship = () => host.querySelector('input[name="relationship"]');
  const existingHousehold = () => host.querySelector('select[name="householdId"]');

  it('shows no Household section and no Email until a role is chosen', () => {
    render();
    expect(householdLegend()).toBeUndefined();
    expect(personalEmail()).toBeNull();
  });

  it('shows the person’s own Email once a role other than camper or parent or guardian is chosen', () => {
    render();
    toggle('instructor');
    expect(personalEmail()).not.toBeNull();
    expect(householdLegend()).toBeUndefined();
  });

  it('shows Household, with a relationship and a household email, for a camper; it does not show the own Email', () => {
    render();
    toggle('camper');
    expect(householdLegend()).toBeDefined();
    expect(relationship()).not.toBeNull();
    expect(householdEmail()).not.toBeNull();
    expect(personalEmail()).toBeNull();
  });

  it('shows Household for a parent or guardian, without a relationship, and the email goes under Household', () => {
    render();
    toggle('guardian');
    expect(householdLegend()).toBeDefined();
    expect(relationship()).toBeNull();
    expect(householdEmail()).not.toBeNull();
    expect(personalEmail()).toBeNull();
  });

  it('hides Household again when the camper and guardian roles are cleared', () => {
    render();
    toggle('camper');
    toggle('camper');
    expect(householdLegend()).toBeUndefined();
  });

  it('keeps the person’s own Email when another role is chosen alongside a camper', () => {
    render();
    toggle('camper');
    toggle('participant');
    expect(personalEmail()).not.toBeNull();
    expect(householdEmail()).not.toBeNull();
  });

  it('offers the existing households once a family role is chosen', () => {
    render(null, [LEE]);
    toggle('guardian');
    expect(existingHousehold()).not.toBeNull();
    expect(host.querySelector(`option[value="${LEE.id}"]`)).not.toBeNull();
  });

  it('says which household the person joins when they come from a guardian page', () => {
    render({ id: LEE.id, name: 'Lee family' }, []);
    toggle('camper');
    expect(host.textContent).toContain('Lee family');
    expect(existingHousehold()).toBeNull();
  });
});
