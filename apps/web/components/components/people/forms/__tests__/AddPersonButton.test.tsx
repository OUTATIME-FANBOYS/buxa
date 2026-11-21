// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { failure, success } from '@buxa/shared';
import { AddPersonButton } from '@/components/components/people/forms';
import { requirePresent } from '@buxa/domain';
import { UiProvider } from '@buxa/middleware/providers/providers';

const createPerson = vi.hoisted(() => vi.fn());
vi.mock('@buxa/server/composers/people/createPersonAction', () => ({ createPersonAction: createPerson }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const NoDialog = () => null;

// The dialog's exit runs for 190ms before it unmounts; wait past it.
const settle = () =>
  act(async () => {
    await new Promise(r => setTimeout(r, 250));
  });
const flush = () =>
  act(async () => {
    await new Promise(r => setTimeout(r, 0));
  });

describe('AddPersonButton (the People page)', () => {
  let root: Root;
  let host: HTMLDivElement;
  beforeEach(() => {
    createPerson.mockReset();
    host = document.body.appendChild(document.createElement('div'));
    root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  const button = () =>
    requirePresent(
      Array.from(host.querySelectorAll('button')).find(b => b.textContent === 'Add person'),
      "Array.from(host.querySelectorAll('button')).find(b => b.textContent === 'Add person')",
    );
  const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');
  const open = async () => {
    button().focus();
    act(() => button().click());
    await flush();
  };

  it('opens the add form in a dialog from the Add person button', async () => {
    act(() =>
      root.render(
        <UiProvider Dialog={NoDialog}>
          <AddPersonButton households={[]} />
        </UiProvider>,
      ),
    );
    expect(dialog()).toBeNull();
    await open();
    expect(dialog()?.getAttribute('aria-label')).toBe('Add person');
    expect(dialog()?.querySelector('form.person-form input[name="givenName"]')).not.toBeNull();
    expect(dialog()?.querySelector('input[name="familyName"]')).not.toBeNull();
    expect(dialog()?.textContent).toContain('Roles');
  });

  it('closes on Escape, returns focus to the button, and leaves no dialog behind', async () => {
    act(() =>
      root.render(
        <UiProvider Dialog={NoDialog}>
          <AddPersonButton households={[]} />
        </UiProvider>,
      ),
    );
    await open();
    await act(() =>
      requirePresent(dialog(), 'dialog()').dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      ),
    );
    await settle();
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(button());
  });

  it('closes from its Cancel button', async () => {
    act(() =>
      root.render(
        <UiProvider Dialog={NoDialog}>
          <AddPersonButton households={[]} />
        </UiProvider>,
      ),
    );
    await open();
    const cancel = requirePresent(
      Array.from(requirePresent(dialog(), 'dialog()').querySelectorAll('button')).find(b => b.textContent === 'Cancel'),
      "Array.from(requirePresent(dialog(), 'dialog()').querySelectorAll('button')).find(b => b.textContent === 'Cancel')",
    );
    act(() => cancel.click());
    await settle();
    expect(dialog()).toBeNull();
  });

  it('shows the validation messages from the action, and focuses the first field with a problem', async () => {
    createPerson.mockResolvedValue(
      failure('Check the highlighted fields.', {
        givenName: 'Enter a first name.',
        roles: 'Pick a role.',
      }),
    );
    act(() =>
      root.render(
        <UiProvider Dialog={NoDialog}>
          <AddPersonButton households={[]} />
        </UiProvider>,
      ),
    );
    await open();
    const form = requirePresent(
      requirePresent(dialog(), 'dialog()').querySelector('form'),
      "requirePresent(dialog(), 'dialog()').querySelector('form')",
    );
    // The first name is required in the browser, so it is filled in: the action's own refusal is what this test checks.
    requirePresent(form.querySelector<HTMLInputElement>('input[name="givenName"]'), 'givenName').value = 'Ada';
    act(() => form.requestSubmit());
    await flush();
    expect(createPerson).toHaveBeenCalledTimes(1);
    expect(requirePresent(dialog(), 'dialog()').textContent).toContain('Enter a first name.');
    expect(requirePresent(dialog(), 'dialog()').textContent).toContain('Pick a role.');
    expect(document.activeElement).toBe(requirePresent(dialog(), 'dialog()').querySelector('input[name="givenName"]'));
  });

  it('submits the fields as typed', async () => {
    createPerson.mockResolvedValue(failure('Check the highlighted fields.', {}));
    act(() =>
      root.render(
        <UiProvider Dialog={NoDialog}>
          <AddPersonButton households={[]} />
        </UiProvider>,
      ),
    );
    await open();
    const given = requirePresent(
      requirePresent(dialog(), 'dialog()').querySelector<HTMLInputElement>('input[name="givenName"]'),
      "requirePresent(dialog(), 'dialog()').querySelector<HTMLInputElement>('input[name=\"givenName\"]')",
    );
    const family = requirePresent(
      requirePresent(dialog(), 'dialog()').querySelector<HTMLInputElement>('input[name="familyName"]'),
      "requirePresent(dialog(), 'dialog()').querySelector<HTMLInputElement>('input[name=\"familyName\"]')",
    );
    given.value = 'Ada';
    family.value = 'Lovelace';
    act(() =>
      requirePresent(
        requirePresent(dialog(), 'dialog()').querySelector('form'),
        "requirePresent(dialog(), 'dialog()').querySelector('form')",
      ).requestSubmit(),
    );
    await flush();
    const data = createPerson.mock.calls[0]?.[1] as FormData;
    expect(data.get('givenName')).toBe('Ada');
    expect(data.get('familyName')).toBe('Lovelace');
  });
  it('a successful add closes the pop-up and shows the toast with the server’s message', async () => {
    createPerson.mockResolvedValue(success('Person added.'));
    act(() =>
      root.render(
        <UiProvider Dialog={NoDialog}>
          <AddPersonButton households={[]} />
        </UiProvider>,
      ),
    );
    await open();
    const given = requirePresent(
      requirePresent(dialog(), 'dialog()').querySelector<HTMLInputElement>('input[name="givenName"]'),
      'givenName',
    );
    given.value = 'Ada';
    act(() => requirePresent(requirePresent(dialog(), 'dialog()').querySelector('form'), 'form').requestSubmit());
    await settle();
    expect(dialog()).toBeNull();
    expect(document.querySelector('[role="status"]')?.textContent).toContain('Person added.');
  });
});
