// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { BadgePanel, type BadgePanelProps } from '@/components/components/people';

// The server actions. Issue, Reissue and Revoke return no code; only Show and Reprint return the stored code.
vi.mock('@buxa/server/composers/people/issueBadgeAction', () => ({
  issueBadgeAction: () => Promise.resolve({ status: 'success' }),
}));
vi.mock('@buxa/server/composers/people/revokeBadgeAction', () => ({
  revokeBadgeAction: () => Promise.resolve({ status: 'success', message: 'Badge revoked.' }),
}));
vi.mock('@buxa/server/composers/people/showBadgeAction', () => ({
  showBadgeAction: () => Promise.resolve({ status: 'shown', payload: 'bx1.storedcodeabcdefghijklm' }),
  reprintBadgeAction: () => Promise.resolve({ status: 'shown', payload: 'bx1.storedcodeabcdefghijklm' }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const base: BadgePanelProps = {
  personId: 'p-1',
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
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function buttonNamed(label: string): HTMLButtonElement {
  const found = [...container.querySelectorAll('button')].find(b => b.textContent === label);
  if (!found) {
    throw new Error(`no button named ${label}`);
  }

  return found;
}

/** Lets the transition the click starts (a server action) settle inside act. */
const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0));

async function click(label: string) {
  await act(() => {
    buttonNamed(label).click();

    return flush();
  });
}

const hasCode = () => container.querySelector('.badge-card') !== null;

describe('BadgePanel: issue, reissue, show and revoke', () => {
  it('after Reissue the card is not rendered, the text shown once is absent, and Show badge then renders the new badge', async () => {
    act(() => {
      root.render(<BadgePanel {...base} hasActiveBadge />);
    });

    await click('Reissue');
    expect(hasCode()).toBe(false);
    expect(container.textContent).toContain('Badge active');
    expect(container.textContent).toContain('Badge reissued.');
    expect(container.textContent).not.toContain('shown once');
    expect(container.textContent).not.toContain('print it now');
    expect(container.textContent).not.toContain('Print badge');

    await click('Show badge');
    expect(hasCode()).toBe(true);
    expect(container.textContent).not.toContain('Badge reissued.');
  });

  it('after Issue on a person with no badge, no code is rendered and the confirmation is shown', async () => {
    act(() => {
      root.render(<BadgePanel {...base} />);
    });

    await click('Issue badge');
    expect(hasCode()).toBe(false);
    expect(container.textContent).toContain('Badge issued.');
    expect(container.textContent).toContain('Badge active');
    expect(container.textContent).not.toContain('shown once');
  });

  it('after Revoke the code is gone, the panel shows Badge revoked. and No active badge', async () => {
    act(() => {
      root.render(<BadgePanel {...base} hasActiveBadge />);
    });

    await click('Show badge');
    expect(hasCode()).toBe(true);

    await click('Revoke');
    expect(hasCode()).toBe(false);
    expect(container.textContent).toContain('No active badge');
    expect(container.textContent).toContain('Badge revoked.');
    expect(container.textContent).not.toContain('Print badge');
    expect([...container.querySelectorAll('button')].map(b => b.textContent)).toEqual(['Issue badge']);
  });

  it('Show badge shows the stored code only when pressed', async () => {
    act(() => {
      root.render(<BadgePanel {...base} hasActiveBadge />);
    });
    expect(hasCode()).toBe(false);

    await click('Show badge');
    expect(hasCode()).toBe(true);
    expect(container.textContent).not.toContain('shown once');
  });
});
