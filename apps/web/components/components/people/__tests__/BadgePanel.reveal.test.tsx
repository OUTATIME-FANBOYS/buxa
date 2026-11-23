// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { UiProvider } from '@buxa/middleware/providers/UiProvider';
import { BadgePanel, type BadgePanelProps } from '@/components/components/people';
import type { ActionState, ShowBadgeState } from '@buxa/shared';

// The server actions. Issue and Revoke return no code; Show returns the stored code, and the panel calls Show after an issue.
const h = vi.hoisted(() => ({
  issue: vi.fn<() => Promise<ActionState>>(),
  revoke: vi.fn<() => Promise<ActionState>>(),
  show: vi.fn<() => Promise<unknown>>(),
}));
vi.mock('@buxa/server/composers/people/issueBadgeAction', () => ({ issueBadgeAction: h.issue }));
vi.mock('@buxa/server/composers/people/revokeBadgeAction', () => ({ revokeBadgeAction: h.revoke }));
vi.mock('@buxa/server/composers/people/showBadgeAction', () => ({
  showBadgeAction: h.show,
  reprintBadgeAction: () => Promise.resolve({ status: 'failed', message: 'unused' }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const CODE = 'bx1.storedcodeabcdefghijklm';
const shown: ShowBadgeState = { status: 'shown', payload: CODE };

const base: BadgePanelProps = {
  personId: '6f1c2a3e-0000-4000-8000-000000000001',
  personName: 'Ada Lee',
  roleLabel: 'Camper',
  campName: 'Camp Birchwood',
  hasActiveBadge: false,
  archived: false,
  canManage: true,
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  h.issue.mockReset().mockResolvedValue({ status: 'success' });
  h.revoke.mockReset().mockResolvedValue({ status: 'success' });
  h.show.mockReset().mockResolvedValue(shown);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(props: BadgePanelProps) {
  act(() => {
    root.render(
      <UiProvider Dialog={() => null}>
        <BadgePanel {...props} />
      </UiProvider>,
    );
  });
}

function buttonNamed(label: string): HTMLButtonElement {
  const found = [...container.querySelectorAll('button')].find(b => b.textContent === label);
  if (!found) {
    throw new Error(`no button named ${label}`);
  }

  return found;
}

/** Lets the transition the click starts (a server action, then a second one) settle inside act. */
const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0));

async function click(label: string) {
  await act(() => {
    buttonNamed(label).click();

    return flush();
  });
}

const hasCard = () => container.querySelector('.badge-card') !== null;
/** The panel's own buttons: the toast's close button sits in `.toasts` and is left out. */
const buttonLabels = () => [...container.querySelectorAll('section button')].map(b => b.textContent);
/** The toasts are the only status text the page shows for a success. */
const toastText = () => container.querySelector('.toasts')?.textContent ?? '';

describe('BadgePanel: show, issue, reissue and revoke', () => {
  it('Show badge opens the badge view with the card, Print badge and Close', async () => {
    render({ ...base, hasActiveBadge: true });
    expect(hasCard()).toBe(false);

    await click('Show badge');

    expect(hasCard()).toBe(true);
    expect(buttonLabels()).toContain('Print badge');
    expect(buttonLabels()).toContain('Close');
    expect(container.textContent).not.toContain('shown once');

    await click('Close');
    expect(hasCard()).toBe(false);
  });

  it('has no Reprint button, and Print badge appears only inside the view', async () => {
    render({ ...base, hasActiveBadge: true });
    expect(buttonLabels()).toEqual(['Show badge', 'Reissue', 'Revoke']);
    expect(buttonLabels()).not.toContain('Print badge');

    await click('Show badge');
    expect(buttonLabels()).not.toContain('Reprint');
  });

  it('Reissue reissues, opens the new card straight away and fires the Badge reissued. toast', async () => {
    render({ ...base, hasActiveBadge: true });

    await click('Reissue');

    expect(h.issue).toHaveBeenCalledTimes(1);
    expect(h.show).toHaveBeenCalledTimes(1);
    expect(hasCard()).toBe(true);
    expect(toastText()).toContain('Badge reissued.');
    expect(container.textContent).not.toContain('shown once');
  });

  it('Issue on a person with no badge opens the new card and fires the Badge issued. toast', async () => {
    render(base);

    await click('Issue badge');

    expect(hasCard()).toBe(true);
    expect(toastText()).toContain('Badge issued.');
    expect(container.textContent).toContain('Badge active');
  });

  it('Revoke fires the Badge revoked. toast, closes the open view and shows No active badge', async () => {
    render({ ...base, hasActiveBadge: true });
    await click('Show badge');
    expect(hasCard()).toBe(true);

    await click('Revoke');

    expect(hasCard()).toBe(false);
    expect(toastText()).toContain('Badge revoked.');
    expect(container.textContent).toContain('No active badge');
    expect(buttonLabels()).toEqual(['Issue badge']);
  });

  it('a failed revoke shows a short inline message and no toast', async () => {
    h.revoke.mockResolvedValue({ status: 'error', message: 'Could not revoke the badge.' });
    render({ ...base, hasActiveBadge: true });

    await click('Revoke');

    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Could not revoke the badge.');
    expect(toastText()).not.toContain('Badge revoked.');
    expect(buttonLabels()).toContain('Revoke');
  });
});
