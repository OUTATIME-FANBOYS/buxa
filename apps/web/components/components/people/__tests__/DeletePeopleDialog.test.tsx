// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DeletePeopleDialog } from '../DeletePeopleDialog';
import { deletePeopleAction } from '@/actions/people';

vi.mock('@/actions/people', () => ({ deletePeopleAction: vi.fn() }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const PERSON = { id: '11111111-1111-4111-8111-111111111111', name: 'Tanmay Test 2' };

function footerButtons(): HTMLButtonElement[] {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('.dialog-foot button'));
}

describe('DeletePeopleDialog', () => {
  let root: Root;
  beforeEach(() => {
    root = createRoot(document.body.appendChild(document.createElement('div')));
    vi.mocked(deletePeopleAction).mockReset();
  });
  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = '';
  });

  it('renders through the danger ConfirmDialog, with the name bold and left aligned', () => {
    act(() => root.render(<DeletePeopleDialog people={[PERSON]} onDone={() => {}} onClose={() => {}} />));
    const body = document.querySelector<HTMLElement>('[data-testid="confirm-body"]');
    expect(body?.className).toContain('buxa:text-left');
    expect(body?.className).not.toContain('text-center');
    const name = Array.from(body?.querySelectorAll('p') ?? []).find(p => p.textContent === 'Tanmay Test 2');
    expect(name?.className).toContain('buxa:font-bold');
    expect(footerButtons().map(b => b.textContent?.trim())).toEqual(['Cancel', 'Delete']);
    expect(footerButtons()[1]?.querySelector('svg')).not.toBeNull();
  });

  it('disables both buttons while the delete runs', () => {
    // A request that never settles keeps the dialog in its pending state for the assertions.
    vi.mocked(deletePeopleAction).mockReturnValue(new Promise<never>(() => {}));
    act(() => root.render(<DeletePeopleDialog people={[PERSON]} onDone={() => {}} onClose={() => {}} />));
    act(() => footerButtons()[1]?.click());
    expect(footerButtons()[0]?.disabled).toBe(true);
    expect(footerButtons()[1]?.disabled).toBe(true);
    expect(footerButtons()[1]?.textContent).toContain('Deleting');
  });
});
