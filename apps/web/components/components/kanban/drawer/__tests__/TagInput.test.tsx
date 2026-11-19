// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { TagInput } from '@/components/components/kanban/drawer';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const field = () => {
  const el = document.querySelector<HTMLInputElement>('input[role="combobox"]');
  if (!el) {
    throw new Error('the tag field is not rendered');
  }

  return el;
};
const typeText = (text: string) =>
  act(() => {
    // The native value setter, so React sees the change (its own tracker ignores a plain assignment).
    // eslint-disable-next-line @typescript-eslint/unbound-method -- called below with the input as its this.
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    set?.call(field(), text);
    field().dispatchEvent(new Event('input', { bubbles: true }));
  });
const press = (key: string) =>
  act(() => void field().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })));
const suggestionsShown = () => Array.from(document.querySelectorAll('[role="option"]')).map(o => o.textContent?.trim());

describe('TagInput', () => {
  it('shows each tag as a chip with a remove control, and the add prompt when there are none', () => {
    const html = renderToStaticMarkup(<TagInput tags={['family']} onChange={vi.fn()} suggestions={[]} />);
    expect(html).toContain('>family<button');
    expect(html).toContain('aria-label="Remove tag family"');
    expect(html).toContain('rounded-[var(--r-1)]!');
    expect(renderToStaticMarkup(<TagInput tags={[]} onChange={vi.fn()} suggestions={[]} />)).toContain(
      'placeholder="Add tags"',
    );
  });
  it('has no list box or datalist until something is typed', () => {
    const html = renderToStaticMarkup(
      <TagInput tags={['family']} onChange={vi.fn()} suggestions={['family', 'medical']} />,
    );
    expect(html).not.toContain('<datalist');
    expect(html).not.toContain('role="listbox"');
  });

  describe('typing', () => {
    let root: Root;
    beforeEach(() => {
      root = createRoot(document.body.appendChild(document.createElement('div')));
    });
    afterEach(() => {
      act(() => root.unmount());
      document.body.innerHTML = '';
    });

    it('filters the suggestions to the typed text, leaving out the tags already on the task', () => {
      act(() =>
        root.render(
          <TagInput tags={['family']} onChange={vi.fn()} suggestions={['family', 'medical', 'medicine', 'mobile']} />,
        ),
      );
      typeText('med');
      expect(suggestionsShown()).toEqual(['medical', 'medicine']);
    });

    it('adds the typed text as a tag on Enter, even when no task has it yet', () => {
      const onChange = vi.fn();
      act(() => root.render(<TagInput tags={['family']} onChange={onChange} suggestions={['family']} />));
      typeText('Vacation');
      press('Enter');
      expect(onChange).toHaveBeenCalledWith(['family', 'vacation']);
      expect(field().value).toBe('');
    });

    it('adds the highlighted suggestion on Enter, and a clicked suggestion', () => {
      const onChange = vi.fn();
      act(() =>
        root.render(<TagInput tags={['family']} onChange={onChange} suggestions={['family', 'medical', 'medicine']} />),
      );
      typeText('med');
      press('ArrowDown');
      press('Enter');
      expect(onChange).toHaveBeenLastCalledWith(['family', 'medical']);
      typeText('med');
      act(() => document.querySelectorAll<HTMLElement>('[role="option"]')[1].click());
      expect(onChange).toHaveBeenLastCalledWith(['family', 'medicine']);
    });

    it('offers a tag made on one task as a suggestion on another', () => {
      const onChange = vi.fn();
      act(() => root.render(<TagInput tags={['family']} onChange={onChange} suggestions={['family']} />));
      typeText('vacation');
      press('Enter');
      expect(onChange).toHaveBeenCalledWith(['family', 'vacation']);
      // The next task sees the tag once the first task carries it.
      act(() => root.render(<TagInput tags={[]} onChange={vi.fn()} suggestions={['family', 'vacation']} />));
      typeText('vac');
      expect(suggestionsShown()).toEqual(['vacation']);
    });

    it('removes the last tag on Backspace from an empty field', () => {
      const onChange = vi.fn();
      act(() => root.render(<TagInput tags={['family', 'school']} onChange={onChange} suggestions={[]} />));
      press('Backspace');
      expect(onChange).toHaveBeenCalledWith(['family']);
    });
  });
});
