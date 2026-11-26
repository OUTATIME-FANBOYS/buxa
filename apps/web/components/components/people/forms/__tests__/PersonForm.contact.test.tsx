// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { type CampRole } from '@buxa/domain';
import { idle } from '@buxa/shared';
import { EMAIL_MESSAGE, PHONE_NUMBER_MESSAGE } from '@buxa/contracts';
import { PersonForm } from '@/components/components/people/forms';
import { UiProvider } from '@buxa/middleware/providers/UiProvider';
import { ConfirmDialog } from '@/components/components';
import { PERSON, formHelpers } from './personFormFixtures';

const actions = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn() }));
vi.mock('@buxa/server/composers/people/createPersonAction', () => ({
  createPersonAction: actions.create,
}));
vi.mock('@buxa/server/composers/people/updatePersonAction', () => ({
  updatePersonAction: actions.update,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * The form's own checks on the phone and email: shown under the field on blur and on submit, with the same messages the server
 * uses. An empty email is fine (it is optional); an empty phone is not, on add.
 */
describe('PersonForm: phone and email checks', () => {
  let root: Root;
  let host: HTMLDivElement;
  beforeEach(() => {
    actions.create.mockReset();
    actions.update.mockReset();
    actions.create.mockResolvedValue(idle);
    actions.update.mockResolvedValue(idle);
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
  const renderEdit = () =>
    act(() => {
      root.render(
        <UiProvider Dialog={ConfirmDialog}>
          <PersonForm
            mode="edit"
            person={{ ...PERSON, roles: ['participant'] }}
            households={[]}
            variant="dialog"
            formId="f"
          />
        </UiProvider>,
      );
    });
  const h = formHelpers(() => host);
  const click = (value: CampRole) => act(() => h.role(value)?.click());
  const type = (name: string, value: string) =>
    act(() => {
      const input = h.input(name);
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
      input?.dispatchEvent(new Event('input', { bubbles: true }));
    });
  const leave = (name: string) =>
    act(() => {
      h.input(name)?.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
  const submit = () => act(() => host.querySelector('form')?.requestSubmit());
  const flush = () =>
    act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
  const errors = () => Array.from(host.querySelectorAll('.field-error')).map(p => p.textContent);

  describe('phone', () => {
    beforeEach(() => {
      renderAdd();
    });

    it('is required: the mark and aria-required are on the field', () => {
      expect(h.input('phone')?.getAttribute('aria-required')).toBe('true');
      expect(h.label('Phone')?.querySelector('.field-required')).not.toBeNull();
    });

    it('shows the message on blur when it is empty', () => {
      leave('phone');
      expect(errors()).toContain(PHONE_NUMBER_MESSAGE);
    });

    it('shows the message on blur when it is too short', () => {
      type('phone', '12345');
      leave('phone');
      expect(errors()).toContain(PHONE_NUMBER_MESSAGE);
    });

    it('shows no message on blur for a valid phone', () => {
      type('phone', '+44 20 7946 0958');
      leave('phone');
      expect(errors()).not.toContain(PHONE_NUMBER_MESSAGE);
    });

    it('refuses a submit with an empty phone, shows the message, and does not run the action', () => {
      type('givenName', 'Ada');
      submit();
      expect(errors()).toContain(PHONE_NUMBER_MESSAGE);
      expect(actions.create).not.toHaveBeenCalled();
    });

    it('lets a valid phone through to the action', async () => {
      type('givenName', 'Ada');
      type('phone', '0400 000 000');
      submit();
      await flush();
      expect(actions.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('email', () => {
    it('shows the message on blur for an invalid address', () => {
      renderAdd();
      click('participant');
      type('email', 'name@example');
      leave('email');
      expect(errors()).toContain(EMAIL_MESSAGE);
    });

    it('shows no message for a valid address', () => {
      renderAdd();
      click('participant');
      type('email', 'name@example.com');
      leave('email');
      expect(errors()).not.toContain(EMAIL_MESSAGE);
    });

    it('is optional: an empty email shows no message', () => {
      renderAdd();
      click('participant');
      leave('email');
      expect(errors()).not.toContain(EMAIL_MESSAGE);
    });

    it('is checked the same way for a family role', () => {
      renderAdd();
      click('guardian');
      type('email', 'parent@example');
      leave('email');
      expect(errors()).toContain(EMAIL_MESSAGE);
    });

    it('refuses a submit with an invalid email and focuses it, when the phone is fine', () => {
      renderAdd();
      type('givenName', 'Ada');
      type('phone', '0400 000 000');
      type('email', 'name@example');
      submit();
      expect(errors()).toContain(EMAIL_MESSAGE);
      expect(actions.create).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(h.input('email'));
    });
  });

  describe('edit', () => {
    it('requires a phone too: a blank phone is refused with the message, and is not saved', async () => {
      renderEdit();
      type('givenName', 'Ada');
      submit();
      await flush();
      expect(errors()).toContain(PHONE_NUMBER_MESSAGE);
      expect(actions.update).not.toHaveBeenCalled();
    });

    it('saves when the phone is given', async () => {
      renderEdit();
      type('givenName', 'Ada');
      type('phone', '0400 000 000');
      submit();
      await flush();
      expect(errors()).not.toContain(PHONE_NUMBER_MESSAGE);
      expect(actions.update).toHaveBeenCalledTimes(1);
    });
  });
});
