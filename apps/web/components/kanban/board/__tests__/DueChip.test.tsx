import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DueChip } from '../DueChip';

describe('DueChip', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2027, 6, 10, 12)); });
  afterEach(() => vi.useRealTimers());

  it('says when a task is due today, with a clock', () => {
    const html = renderToStaticMarkup(<DueChip due="2027-07-10" kind="open" />);
    expect(html).toContain('due due-soon');
    expect(html).toContain('Today');
  });
  it('shows an overdue task in words, not colour alone', () => {
    expect(renderToStaticMarkup(<DueChip due="2027-07-07" kind="active" />)).toContain('3d overdue');
  });
  it('shows a finished task with its date and a check', () => {
    const html = renderToStaticMarkup(<DueChip due="2027-07-02" kind="done" />);
    expect(html).toContain('due-done');
  });
  it('renders nothing without a due date', () => {
    expect(renderToStaticMarkup(<DueChip kind="open" />)).toBe('');
  });
});
