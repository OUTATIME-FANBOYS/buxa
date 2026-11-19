// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import type { OnSiteRowView } from '@buxa/shared';
import { OnSiteRow } from '@/components/components/attendance';
import { settle, requirePresent } from '@buxa/domain';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {}, push() {} }) }));
vi.mock('@buxa/server/composers/attendance/checkOut', () => ({
  checkOutAction: () => settle(() => ({ kind: 'ok', value: {} })),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const row = {
  personId: 'p-1',
  name: 'Mia Cole',
  arrivedAt: '09:05',
  isMinor: true,
  pickupOptions: [],
} as unknown as OnSiteRowView;

describe('OnSiteRow card', () => {
  it('shows the name, a warn-tone Minor pill and the checked-in and checked-out lines', () => {
    const html = renderToStaticMarkup(<OnSiteRow row={row} canRecord={false} canOverride={false} />);
    expect(html).toContain('<span class="onsite-name">Mia Cole</span>');
    expect(html).toMatch(/<span class="pill pill-warn [^"]*">Minor<\/span>/);
    expect(html).not.toContain('pill-neutral');
    expect(html).toContain('<p>Checked in: 09:05</p>');
    expect(html).toContain('<p>Checked out: —</p>');
    expect(html).not.toContain('Check out</button>');
  });

  it('leaves out the Minor pill for an adult', () => {
    const html = renderToStaticMarkup(
      <OnSiteRow row={{ ...row, isMinor: false }} canRecord={false} canOverride={false} />,
    );
    expect(html).not.toContain('Minor');
  });

  it('offers a compact check-out control to staff who can record it', () => {
    const html = renderToStaticMarkup(<OnSiteRow row={row} canRecord canOverride={false} />);
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toMatch(/<button[^>]*class="[^"]*button--primary[^"]*button--header"[^>]*>Check out<\/button>/);
  });
});

describe('OnSiteRow check-out dialog', () => {
  let root: Root;
  beforeEach(() => {
    root = createRoot(document.body.appendChild(document.createElement('div')));
  });
  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = '';
    document.body.style.overflow = '';
    vi.useRealTimers();
  });

  it('opens the panel in a dialog from Check out, and Escape closes it and returns focus to Check out', () => {
    vi.useFakeTimers();
    act(() => root.render(<OnSiteRow row={row} canRecord canOverride={false} />));
    const trigger = requirePresent(
      document.querySelector<HTMLButtonElement>('button.button--header'),
      "document.querySelector<HTMLButtonElement>('button.button--header')",
    );
    expect(document.querySelector('[role="dialog"]')).toBeNull();

    act(() => {
      trigger.click();
    });
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(requirePresent(dialog, 'dialog').querySelector('h2')?.textContent).toBe('Check out Mia Cole');
    expect(requirePresent(dialog, 'dialog').querySelector('form.checkout-panel')).not.toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(requirePresent(dialog, 'dialog').querySelector('.checkout-actions')?.textContent).toContain(
      'CancelCheck out',
    );

    act(() => {
      requirePresent(dialog, 'dialog').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('Cancel inside the dialog closes it at once', () => {
    act(() => root.render(<OnSiteRow row={row} canRecord canOverride={false} />));
    act(() => {
      requirePresent(
        document.querySelector<HTMLButtonElement>('button.button--header'),
        "document.querySelector<HTMLButtonElement>('button.button--header')",
      ).click();
    });
    const cancel = requirePresent(
      [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(b => b.textContent === 'Cancel'),
      "[...document.querySelectorAll<HTMLButtonElement>('[role=\"dialog\"] button')].find(b => b.textContent === 'Cancel')",
    );
    act(() => {
      cancel.click();
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});
