// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { CalendarLinkCard } from '@/components/components/camp/CalendarLinkCard';

type RotateResult = { ok: true; token: string } | { ok: false; message: string };

const rotate = vi.fn<() => Promise<RotateResult>>();
vi.mock('@/actions/camp', () => ({
  rotateCalendarTokenAction: () => rotate(),
  rotateOwnCalendarTokenAction: () => rotate(),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TOKEN = 'tok123';
const LINK = `${window.location.origin}/calendar?token=${TOKEN}`;

function buttonByLabel(label: string): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
}

function buttonByText(text: string): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(b => b.textContent === text);
}

/** Lets pending action promises settle and React flush the resulting state. */
async function flush() {
  await act(() => new Promise<void>(resolve => setTimeout(resolve, 0)));
}

describe('CalendarLinkCard', () => {
  let root: Root;
  let writeText: ReturnType<typeof vi.fn<(text: string) => Promise<void>>>;

  beforeEach(() => {
    rotate.mockReset();
    rotate.mockResolvedValue({ ok: true, token: TOKEN });
    writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    root = createRoot(document.body.appendChild(document.createElement('div')));
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = '';
  });

  async function renderCard() {
    act(() => {
      root.render(<CalendarLinkCard />);
    });
    await flush();
  }

  async function makeLink() {
    const make = buttonByText('Make a calendar link');
    expect(make).toBeDefined();
    act(() => {
      make?.click();
    });
    await flush();
  }

  it('renders "Make a calendar link" as a primary button element, not a text link', async () => {
    await renderCard();
    const make = buttonByText('Make a calendar link');
    expect(make?.tagName).toBe('BUTTON');
    expect(make?.className).toContain('button--primary');
    expect(document.querySelector('a')).toBeNull();
  });

  it('shows the link once with the warning, then the copy and refresh icon buttons inside the field', async () => {
    await renderCard();
    await makeLink();
    expect(document.querySelector<HTMLInputElement>('input.calendar-link__input')?.value).toBe(LINK);
    expect(document.body.textContent).toContain('Copy it now. It is not shown again.');
    expect(document.querySelector('.calendar-link__actions')).not.toBeNull();
    expect(buttonByText('Make a calendar link')).toBeUndefined();
  });

  it('gives the copy button its label and copies the link when pressed', async () => {
    await renderCard();
    await makeLink();
    const copy = buttonByLabel('Copy link');
    expect(copy).not.toBeNull();
    act(() => {
      copy?.click();
    });
    await flush();
    expect(writeText).toHaveBeenCalledWith(LINK);
    expect(document.querySelector('[role="status"]')?.textContent).toBe('Copied.');
  });

  it('gives the refresh button its label and makes a new link when pressed', async () => {
    await renderCard();
    await makeLink();
    const refresh = buttonByLabel('Make a new link');
    expect(refresh).not.toBeNull();
    act(() => {
      refresh?.click();
    });
    await flush();
    expect(rotate).toHaveBeenCalledTimes(2);
  });

  it('keeps no text-link buttons for these actions', async () => {
    await renderCard();
    await makeLink();
    const textOnly = Array.from(document.querySelectorAll('button.button--ghost')).filter(
      b => b.textContent === 'Copy link' || b.textContent === 'Make a new link',
    );
    expect(textOnly).toHaveLength(0);
  });
});
