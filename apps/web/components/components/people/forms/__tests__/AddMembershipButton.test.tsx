// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Session } from '@buxa/contracts';
import { failure, success } from '@buxa/shared';
import { AddMembershipButton } from '@/components/components/people/forms';
import { requirePresent } from '@buxa/domain';
import { UiProvider } from '@buxa/middleware/providers/providers';

const addMembership = vi.hoisted(() => vi.fn());
vi.mock('@buxa/server/composers/people/addMembershipAction', () => ({ addMembershipAction: addMembership }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const NoDialog = () => null;

const SUMMER: Session = {
  id: '5a5a5a5a-5a5a-4a5a-8a5a-5a5a5a5a5a5a',
  name: 'Summer camp',
  description: '',
  startsOn: '2027-07-01',
  endsOn: '2027-08-30',
  classCount: 2,
  isPublic: false,
  archivedAt: null,
  createdAt: '2027-01-01T00:00:00.000Z',
};
const UNDATED: Session = {
  ...SUMMER,
  id: '6b6b6b6b-6b6b-4b6b-8b6b-6b6b6b6b6b6b',
  name: 'Open dates',
  startsOn: null,
  endsOn: null,
};

// The dialog's exit runs for 190ms before it unmounts; wait past it.
const settle = () =>
  act(async () => {
    await new Promise(r => setTimeout(r, 250));
  });
const flush = () =>
  act(async () => {
    await new Promise(r => setTimeout(r, 0));
  });

describe('AddMembershipButton (the membership card)', () => {
  let root: Root;
  let host: HTMLDivElement;
  beforeEach(() => {
    addMembership.mockReset();
    host = document.body.appendChild(document.createElement('div'));
    root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  const render = () =>
    act(() =>
      root.render(
        <UiProvider Dialog={NoDialog}>
          <AddMembershipButton personId="p-1" sessions={[SUMMER, UNDATED]} />
        </UiProvider>,
      ),
    );
  const button = () =>
    requirePresent(
      Array.from(host.querySelectorAll('button')).find(b => b.textContent === 'Add membership'),
      'Add membership button',
    );
  const dialog = () => requirePresent(document.querySelector<HTMLElement>('[role="dialog"]'), 'dialog');
  const open = async () => {
    act(() => button().click());
    await flush();
  };
  const select = () =>
    requirePresent(dialog().querySelector<HTMLSelectElement>('select[name="sessionId"]'), 'Session dropdown');
  const choose = async (value: string) => {
    select().value = value;
    act(() => {
      select().dispatchEvent(new Event('change', { bubbles: true }));
    });
    await flush();
  };
  const submit = async () => {
    act(() => requirePresent(dialog().querySelector('form'), 'form').requestSubmit());
    await flush();
  };

  it('opens the Add membership pop-up from the card button', async () => {
    render();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    await open();
    expect(dialog().getAttribute('aria-label')).toBe('Add membership');
    expect(dialog().querySelector('form')?.id).toBe('add-membership-form');
  });

  it('lists the camp sessions that have dates, then Custom, under the Session label', async () => {
    render();
    await open();
    const labels = Array.from(select().options).map(o => o.textContent);
    expect(labels).toEqual(['Choose a session', 'Summer camp', 'Custom']);
    expect(dialog().textContent).toContain('Session');
  });

  it('shows the chosen session dates as small text and sends its id', async () => {
    render();
    await open();
    await choose(SUMMER.id);
    expect(dialog().textContent).toContain('1 Jul 2027 to 30 Aug 2027');
    expect(dialog().querySelector('input[type="text"][name="plan"]')).toBeNull();
    expect(dialog().querySelector<HTMLInputElement>('input[type="hidden"][name="plan"]')?.value).toBe('Summer camp');
    const form = requirePresent(dialog().querySelector<HTMLFormElement>('form'), 'form');
    expect(new FormData(form).get('sessionId')).toBe(SUMMER.id);
    expect(new FormData(form).get('plan')).toBe('Summer camp');
  });

  it('shows Name and the two dates for Custom, and sends no session id', async () => {
    addMembership.mockResolvedValue(failure('Check the highlighted fields.', {}));
    render();
    await open();
    await choose('custom');
    expect(dialog().querySelector('input[name="plan"]')).not.toBeNull();
    expect(dialog().querySelector('input[name="startsOn"]')).not.toBeNull();
    expect(dialog().querySelector('input[name="endsOn"]')).not.toBeNull();
    expect(dialog().textContent).toContain('Starts on');
    expect(dialog().textContent).toContain('Ends on');
    expect(dialog().querySelector('input[name="sessionId"]')).toBeNull();
    const form = requirePresent(dialog().querySelector<HTMLFormElement>('form'), 'form');
    expect(new FormData(form).get('sessionId')).toBe('custom');
  });

  it('a successful add closes the pop-up and toasts the server message', async () => {
    addMembership.mockResolvedValue(success('Membership added.'));
    render();
    await open();
    await choose(SUMMER.id);
    await submit();
    await settle();
    expect(addMembership).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.querySelector('[role="status"]')?.textContent).toContain('Membership added.');
  });
});
