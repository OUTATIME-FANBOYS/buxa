// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Person } from '@buxa/contracts';
import { requirePresent, settle } from '@buxa/domain';
import { UiProvider } from '@buxa/middleware/providers/UiProvider';
import { ConfirmDialog } from '@/components/components';
import { EditPersonButton } from '@/components/components/people/forms';

const loadPerson = vi.hoisted(() => vi.fn());
vi.mock('@buxa/server/composers/people/loadPersonAction', () => ({ loadPersonAction: loadPerson }));
vi.mock('@buxa/server/composers/people/updatePersonAction', () => ({
  updatePersonAction: () => settle(() => ({ status: 'idle' })),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ID = '22222222-2222-4222-8222-222222222222';
const PERSON = {
  id: ID,
  givenName: 'Ben',
  familyName: 'Stone',
  roles: ['participant'],
  dateOfBirth: '2012-05-06',
  email: 'ben@example.test',
  phone: '0400 333 444',
  isMinor: true,
  memberships: [],
  households: [],
  archived: false,
  status: null,
  onSite: null,
} as unknown as Person;

const flush = () =>
  act(async () => {
    await new Promise(r => setTimeout(r, 0));
  });

describe("the person page's Edit details opens the Edit person pop-up, not /edit", () => {
  let root: Root;
  let host: HTMLDivElement;

  beforeEach(() => {
    loadPerson.mockReset();
    loadPerson.mockResolvedValue(PERSON);
    host = document.body.appendChild(document.createElement('div'));
    root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    document.body.innerHTML = '';
  });

  const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');
  const detailsButton = () =>
    requirePresent(
      Array.from(host.querySelectorAll('button')).find(b => b.textContent === 'Edit details'),
      "the 'Edit details' button",
    );

  it('clicking Edit details opens the same pop-up in edit mode, and no link goes to /edit', async () => {
    act(() => {
      root.render(
        <UiProvider Dialog={ConfirmDialog}>
          <EditPersonButton personId={ID} label="Edit details" />
        </UiProvider>,
      );
    });
    expect(host.querySelector('a[href$="/edit"]')).toBeNull();
    expect(dialog()).toBeNull();

    act(() => detailsButton().click());
    await flush();

    expect(loadPerson).toHaveBeenCalledWith(ID);
    expect(dialog()?.getAttribute('aria-label')).toBe('Edit person');
    expect(dialog()?.querySelector<HTMLInputElement>('input[name="givenName"]')?.value).toBe('Ben');
    expect(host.querySelector('a[href$="/edit"]')).toBeNull();
  });

  it('opens straight away when the page arrives at the /edit address', async () => {
    act(() => {
      root.render(
        <UiProvider Dialog={ConfirmDialog}>
          <EditPersonButton personId={ID} label="Edit details" initiallyOpen />
        </UiProvider>,
      );
    });
    await flush();

    expect(loadPerson).toHaveBeenCalledWith(ID);
    expect(dialog()?.getAttribute('aria-label')).toBe('Edit person');
  });
});
