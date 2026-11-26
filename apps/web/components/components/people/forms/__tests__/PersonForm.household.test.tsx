// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { requirePresent, settle } from '@buxa/domain';
import { CAMPER_NEEDS_HOUSEHOLD, failure, idle } from '@buxa/shared';
import { AddPersonButton, PersonForm } from '@/components/components/people/forms';
import { UiProvider } from '@buxa/middleware/providers/UiProvider';
import { ConfirmDialog } from '@/components/components';
import { LEE, PERSON, formHelpers } from './personFormFixtures';

const createPerson = vi.hoisted(() => vi.fn());
vi.mock('@buxa/server/composers/people/createPersonAction', () => ({ createPersonAction: createPerson }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('@buxa/server/composers/people/updatePersonAction', () => ({
  updatePersonAction: () => settle(() => idle),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const flush = () =>
  act(async () => {
    await new Promise(r => setTimeout(r, 0));
  });
// The dialog's exit runs for 190ms before it unmounts; wait past it.
const settleDialog = () =>
  act(async () => {
    await new Promise(r => setTimeout(r, 250));
  });

describe('PersonForm (edit): the Household section is pre-filled from the person', () => {
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
  const h = formHelpers(() => host);

  const renderEdit = (households: { id: string; name: string; members: [] }[], list = [LEE]) =>
    act(() => {
      root.render(
        <UiProvider Dialog={ConfirmDialog}>
          <PersonForm
            mode="edit"
            person={{ ...PERSON, roles: ['guardian'], households }}
            households={list}
            variant="dialog"
            formId="f"
          />
        </UiProvider>,
      );
    });

  it("selects the person's existing household in the Existing household select", () => {
    renderEdit([{ id: LEE.id, name: LEE.name, members: [] }]);
    expect(h.select('householdId')?.value).toBe(LEE.id);
  });

  it("offers the person's household by name when the camp's list does not carry it, and selects it", () => {
    renderEdit([{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Stone family', members: [] }], []);
    const select = h.select('householdId');
    expect(select?.value).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    expect(select?.selectedOptions[0]?.textContent).toContain('Stone family');
  });

  it('leaves the select on "Not an existing household" when the person has no household', () => {
    renderEdit([]);
    expect(h.select('householdId')?.value).toBe('');
  });

  it('keeps the New household name blank when the household is already chosen', () => {
    renderEdit([{ id: LEE.id, name: LEE.name, members: [] }]);
    expect(h.input('newHouseholdName')?.value).toBe('');
  });
});

describe('PersonForm (add): a camper must join a household with a parent or guardian in it', () => {
  let root: Root;
  let host: HTMLDivElement;
  beforeEach(() => {
    createPerson.mockReset();
    createPerson.mockResolvedValue(idle);
    host = document.body.appendChild(document.createElement('div'));
    root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });
  const h = formHelpers(() => host);

  it('shows the small error under the household select when the server refuses a camper with no household', async () => {
    createPerson.mockResolvedValue(failure('Check the highlighted fields.', { householdId: CAMPER_NEEDS_HOUSEHOLD }));
    act(() => {
      root.render(
        <UiProvider Dialog={ConfirmDialog}>
          <PersonForm mode="create" household={null} households={[LEE]} variant="dialog" formId="f" />
        </UiProvider>,
      );
    });
    act(() => requirePresent(h.role('camper'), 'camper').click());
    requirePresent(h.input('givenName'), 'givenName').value = 'Ada';
    requirePresent(h.input('phone'), 'phone').value = '555-0100';
    act(() => requirePresent(host.querySelector('form'), 'form').requestSubmit());
    await flush();

    expect(createPerson).toHaveBeenCalledTimes(1);
    expect(host.querySelector('.field-error')?.textContent).toBe(CAMPER_NEEDS_HOUSEHOLD);
  });
});

describe('AddPersonButton dialog footer: Cancel then the primary action, on the right', () => {
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

  it('is not centred, has a spacer before the buttons, and orders Cancel before Add person', async () => {
    act(() => {
      root.render(
        <UiProvider Dialog={ConfirmDialog}>
          <AddPersonButton households={[]} />
        </UiProvider>,
      );
    });
    act(() =>
      requirePresent(
        Array.from(host.querySelectorAll('button')).find(b => b.textContent === 'Add person'),
        'button',
      ).click(),
    );
    await flush();

    const dialog = requirePresent(document.querySelector<HTMLElement>('[role="dialog"]'), 'dialog');
    const cancel = requirePresent(
      Array.from(dialog.querySelectorAll('button')).find(b => b.textContent === 'Cancel'),
      'Cancel',
    );
    const footer = requirePresent(cancel.closest('footer'), 'footer');
    expect(footer.className).not.toContain('justify-center');
    expect(footer.querySelector('.buxa\\:flex-1')).not.toBeNull();
    const labels = Array.from(footer.querySelectorAll('button')).map(b => b.textContent);
    expect(labels).toEqual(['Cancel', 'Add person']);
    await settleDialog();
  });
});
