// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Person, PersonSummary } from '@buxa/contracts';
import { requirePresent, settle } from '@buxa/domain';
import { UiProvider } from '@buxa/middleware/providers/UiProvider';
import { Dialog as ConfirmDialog } from '@/components/components';
import { PeopleTable } from '@/components/components/people';

const loadPerson = vi.hoisted(() => vi.fn());
vi.mock('@buxa/server/composers/people/loadPersonAction', () => ({ loadPersonAction: loadPerson }));
vi.mock('@buxa/server/composers/people/updatePersonAction', () => ({
  updatePersonAction: () => settle(() => ({ status: 'idle' })),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ID = '11111111-1111-4111-8111-111111111111';
const ROW = {
  id: ID,
  givenName: 'Ana',
  familyName: 'Lee',
  preferredName: null,
  roles: ['participant'],
  status: null,
  onSite: null,
  archived: false,
} as PersonSummary;
const FULL: Person = {
  ...ROW,
  dateOfBirth: '2015-03-04',
  email: 'ana@example.test',
  phone: '0400 111 222',
  isMinor: true,
  memberships: [],
  households: [],
} as unknown as Person;

// The dialog's exit runs for 190ms before it unmounts; wait past it.
const flush = () =>
  act(async () => {
    await new Promise(r => setTimeout(r, 0));
  });

describe('Edit on a People row opens the Edit person pop-up, not a page', () => {
  let root: Root;
  let host: HTMLDivElement;
  beforeEach(() => {
    loadPerson.mockReset();
    loadPerson.mockResolvedValue(FULL);
    host = document.body.appendChild(document.createElement('div'));
    root = createRoot(host);
    act(() => {
      root.render(
        <UiProvider Dialog={ConfirmDialog}>
          <PeopleTable people={[ROW]} staffView canEdit canDelete={false} />
        </UiProvider>,
      );
    });
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    document.body.innerHTML = '';
  });

  const editButton = () =>
    requirePresent(
      Array.from(host.querySelectorAll('button')).find(b => b.textContent === 'Edit'),
      "Array.from(host.querySelectorAll('button')).find(b => b.textContent === 'Edit')",
    );
  const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');

  it('renders Edit as a button, not a link to the edit page', () => {
    expect(editButton().tagName).toBe('BUTTON');
    expect(host.querySelector('a[href$="/edit"]')).toBeNull();
  });

  it('opens the Edit person pop-up pre-filled with the person, without leaving the list', async () => {
    act(() => editButton().click());
    await flush();

    expect(loadPerson).toHaveBeenCalledWith(ID);
    expect(dialog()?.getAttribute('aria-label')).toBe('Edit person');
    expect(dialog()?.querySelector<HTMLInputElement>('input[name="givenName"]')?.value).toBe('Ana');
    expect(dialog()?.querySelector<HTMLInputElement>('input[name="familyName"]')?.value).toBe('Lee');
    expect(dialog()?.querySelector<HTMLInputElement>('input[name="email"]')?.value).toBe('ana@example.test');
    expect(dialog()?.querySelector<HTMLInputElement>('input[name="phone"]')?.value).toBe('0400 111 222');
    expect(dialog()?.querySelector<HTMLInputElement>('input[name="dateOfBirth"]')?.value).toBe('2015-03-04');
    expect(dialog()?.textContent).toContain('Save changes');
    // The list is still on screen behind the pop-up.
    expect(host.querySelector('table')).not.toBeNull();
  });
});
