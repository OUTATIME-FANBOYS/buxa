// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ReactNode } from 'react';
import { UiProvider } from '@buxa/middleware/providers/providers';
import { sessionDeleteImpactAction } from '@/actions/classes';
import { classesPrompt, SessionClassesDialog } from '../SessionClassesDialog';

vi.mock('@/actions/classes', () => ({
  setSessionArchivedAction: vi.fn(),
  publishSessionAction: vi.fn(),
  sessionDeleteImpactAction: vi.fn(),
  deleteSessionWithClassesAction: vi.fn(),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NoDialog = () => null;
const withUi = (node: ReactNode) => <UiProvider Dialog={NoDialog}>{node}</UiProvider>;
const SESSION = { id: '11111111-1111-4111-8111-111111111111', name: 'Summer 2027', classCount: 2 };

const buttonWith = (text: string) =>
  Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === text) ?? null;

describe('classesPrompt', () => {
  it('says how many classes there are, and the two ways forward', () => {
    expect(classesPrompt('Summer 2027', 2)).toBe(
      'Summer 2027 has 2 classes. Archive the session, or delete its classes and the session.',
    );
  });

  it('uses the singular for one class', () => {
    expect(classesPrompt('Summer 2027', 1)).toContain('has 1 class.');
  });
});

describe('SessionClassesDialog', () => {
  let root: Root;
  beforeEach(() => {
    root = createRoot(document.body.appendChild(document.createElement('div')));
  });
  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = '';
  });

  it('offers archive and delete-both, and does not ask for a plain delete', () => {
    act(() => root.render(withUi(<SessionClassesDialog session={SESSION} onArchived={() => {}} onClose={() => {}} />)));
    expect(document.body.textContent).toContain(
      'Summer 2027 has 2 classes. Archive the session, or delete its classes and the session.',
    );
    expect(buttonWith('Archive session')).not.toBeNull();
    expect(buttonWith('Delete classes and session')).not.toBeNull();
    expect(document.querySelector('input[name="confirmName"]')).toBeNull();
  });

  it('keeps the delete-both button off until the session name is typed exactly', () => {
    act(() => root.render(withUi(<SessionClassesDialog session={SESSION} onArchived={() => {}} onClose={() => {}} />)));
    act(() => buttonWith('Delete classes and session')?.click());

    const input = document.querySelector<HTMLInputElement>('input[name="confirmName"]');
    expect(input).not.toBeNull();
    const submit = () =>
      Array.from(document.querySelectorAll('button')).find(
        b => b.type === 'submit' && b.textContent?.trim() === 'Delete classes and session',
      );
    expect(submit()?.disabled).toBe(true);

    act(() => {
      setInputValue(input, 'summer 2027');
    });
    expect(submit()?.disabled).toBe(true);

    act(() => {
      setInputValue(input, 'Summer 2027');
    });
    expect(submit()?.disabled).toBe(false);
  });

  it('a Back button returns to the two choices without deleting', () => {
    act(() => root.render(withUi(<SessionClassesDialog session={SESSION} onArchived={() => {}} onClose={() => {}} />)));
    act(() => buttonWith('Delete classes and session')?.click());
    act(() => buttonWith('Back')?.click());
    expect(document.querySelector('input[name="confirmName"]')).toBeNull();
    expect(buttonWith('Archive session')).not.toBeNull();
  });
});

describe('SessionClassesDialog for a draft', () => {
  let root: Root;
  const DRAFT = { ...SESSION, status: 'draft' as const };
  beforeEach(() => {
    root = createRoot(document.body.appendChild(document.createElement('div')));
    vi.mocked(sessionDeleteImpactAction).mockClear();
    vi.mocked(sessionDeleteImpactAction).mockResolvedValue({
      ok: true,
      impact: { classes: 2, groups: 1, rooms: 0, assignments: 3, instructors: 2, formLinks: 1 },
    });
  });
  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = '';
  });

  it('says a draft can be deleted with everything under it', () => {
    expect(classesPrompt('Summer 2027', 2, 'draft')).toContain('is a draft with 2 classes');
    expect(classesPrompt('Summer 2027', 2, 'live')).not.toContain('draft');
  });

  it('lists what will be removed before the name is typed, and only then enables the delete', async () => {
    act(() => root.render(withUi(<SessionClassesDialog session={DRAFT} onArchived={() => {}} onClose={() => {}} />)));
    act(() => buttonWith('Delete classes and session')?.click());
    await act(async () => {
      await Promise.resolve();
    });

    const text = document.body.textContent ?? '';
    expect(sessionDeleteImpactAction).toHaveBeenCalledWith(SESSION.id);
    expect(text).toContain('2 classes');
    expect(text).toContain('1 group');
    expect(text).toContain('3 assignments');
    expect(text).toContain('2 instructor links');
    expect(text).toContain('1 registration form link');
    expect(text).not.toContain('rooms');

    const submit = () =>
      Array.from(document.querySelectorAll('button')).find(
        b => b.type === 'submit' && b.textContent?.trim() === 'Delete draft and everything under it',
      );
    expect(submit()?.disabled).toBe(true);
    act(() => {
      setInputValue(document.querySelector<HTMLInputElement>('input[name="confirmName"]'), 'Summer 2027');
    });
    expect(submit()?.disabled).toBe(false);
  });

  it('a live session shows no list, and tells the person to unenrol first', () => {
    act(() =>
      root.render(
        withUi(
          <SessionClassesDialog session={{ ...SESSION, status: 'live' }} onArchived={() => {}} onClose={() => {}} />,
        ),
      ),
    );
    act(() => buttonWith('Delete classes and session')?.click());
    expect(sessionDeleteImpactAction).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('unenrol everyone first');
  });
});

/** Sets a controlled input's value the way a person typing does, so React's onChange sees it. */
function setInputValue(input: HTMLInputElement | null, value: string): void {
  if (!input) {
    return;
  }
  // React listens for the input event, so set the value through the native setter.
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
