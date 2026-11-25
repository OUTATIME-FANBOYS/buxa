// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { settle, type CampRole } from '@buxa/domain';
import { idle } from '@buxa/shared';
import { PersonForm } from '@/components/components/people/forms';
import { UiProvider } from '@buxa/middleware/providers/UiProvider';
import { ConfirmDialog } from '@/components/components';
import { PERSON, formHelpers } from './personFormFixtures';

vi.mock('@buxa/server/composers/people/createPersonAction', () => ({
  createPersonAction: () => settle(() => idle),
}));
vi.mock('@buxa/server/composers/people/updatePersonAction', () => ({
  updatePersonAction: () => settle(() => idle),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * The sections follow the roles: Camper details for a camper, and Parent or guardian for a family role. The emergency contact is not
 * on either pop-up: it is kept on the person's page.
 */
describe('PersonForm: sections follow the roles', () => {
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
          <PersonForm mode="create" household={null} households={[]} variant="dialog" formId="f" />
        </UiProvider>,
      );
    });
  const renderEdit = (roles: CampRole[]) =>
    act(() => {
      root.render(
        <UiProvider Dialog={ConfirmDialog}>
          <PersonForm mode="edit" person={{ ...PERSON, roles }} households={[]} variant="dialog" formId="f" />
        </UiProvider>,
      );
    });
  const h = formHelpers(() => host);
  const click = (value: CampRole) => act(() => h.role(value)?.click());
  const legendNames = () =>
    Array.from(host.querySelectorAll('legend'))
      .map(l => l.textContent?.trim())
      .filter((text): text is string => text !== undefined && text !== '');

  describe('add a camper', () => {
    beforeEach(() => {
      renderAdd();
      click('camper');
    });

    it('shows Camper details with first name, last name and date of birth', () => {
      expect(h.legend('Camper details')).toBeDefined();
      expect(h.legend('Person details')).toBeUndefined();
      expect(h.label('First name')).toBeDefined();
      expect(h.label('Last name')).toBeDefined();
      expect(h.label('Date of birth')).toBeDefined();
    });

    it('shows the Parent or guardian section, with the household email, phone and household', () => {
      expect(h.legend('Parent or guardian')).toBeDefined();
      expect(h.label('Household email')).toBeDefined();
      expect(h.label('Phone')).toBeDefined();
      expect(h.legend('Household')).toBeDefined();
    });

    it('has no emergency contact section: the pop-up does not ask for one', () => {
      expect(h.legend('Emergency contact')).toBeUndefined();
      expect(h.input('emergencyContactName')).toBeNull();
      expect(h.input('emergencyContactPhone')).toBeNull();
      expect(h.input('emergencyContactRelationship')).toBeNull();
    });

    it('puts date of birth and phone side by side, and both are required', () => {
      const pair = host.querySelector('.form-pair');
      expect(pair?.querySelector('input[name="dateOfBirth"]')).not.toBeNull();
      expect(pair?.querySelector('input[name="phone"]')).not.toBeNull();
      expect(h.input('dateOfBirth')?.getAttribute('aria-required')).toBe('true');
      expect(h.input('phone')?.getAttribute('aria-required')).toBe('true');
    });

    it('lists the sections in order: camper details, roles, then parent or guardian', () => {
      const names = legendNames();
      // The Roles legend carries a required mark, so it is matched by its start.
      const at = ['Camper details', 'Roles', 'Parent or guardian'].map(name =>
        names.findIndex(legend => legend.startsWith(name)),
      );
      expect(at.every(i => i >= 0)).toBe(true);
      expect([...at].sort((a, b) => a - b)).toEqual(at);
    });

    it('keeps one Phone field and one email field, each in its section', () => {
      expect(host.querySelectorAll('input[name="phone"]')).toHaveLength(1);
      expect(host.querySelectorAll('input[name="email"]')).toHaveLength(1);
    });
  });

  describe('add a staff-only role', () => {
    it('hides the parent section and the emergency contact, and keeps Email and Phone in Person details', () => {
      renderAdd();
      click('participant');
      expect(h.legend('Parent or guardian')).toBeUndefined();
      expect(h.legend('Emergency contact')).toBeUndefined();
      expect(h.legend('Household')).toBeUndefined();
      expect(h.legend('Person details')).toBeDefined();
      expect(h.label('Phone')).toBeDefined();
      expect(h.label('Email')).toBeDefined();
      expect(h.input('emergencyContactName')).toBeNull();
    });

    it('hides the parent section for an instructor as well', () => {
      renderAdd();
      click('instructor');
      expect(h.legend('Parent or guardian')).toBeUndefined();
      expect(h.legend('Camper details')).toBeUndefined();
    });
  });

  describe('add a parent or guardian', () => {
    it('shows the parent section but no emergency contact, since the emergency contact is for a camper', () => {
      renderAdd();
      click('guardian');
      expect(h.legend('Parent or guardian')).toBeDefined();
      expect(h.legend('Person details')).toBeDefined();
      expect(h.legend('Emergency contact')).toBeUndefined();
    });
  });

  describe('edit', () => {
    it('shows Camper details for a camper, and the parent section, but no emergency contact (it is edited on the page)', () => {
      renderEdit(['camper']);
      expect(h.legend('Camper details')).toBeDefined();
      expect(h.legend('Parent or guardian')).toBeDefined();
      expect(h.legend('Emergency contact')).toBeUndefined();
      expect(h.input('emergencyContactName')).toBeNull();
    });
  });
});
