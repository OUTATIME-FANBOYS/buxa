import { describe, expect, it } from 'vitest';
import { CHECK_IN_TABS, resolveCheckInTab, visibleCheckInTabs } from '../checkInTabs';

describe('visibleCheckInTabs', () => {
  it('keeps the four tabs in order for someone who may update the camp', () => {
    expect(visibleCheckInTabs(true)).toEqual(['scan', 'family', 'link', 'phones']);
  });

  it('hides the check-in link tab for someone who may not update the camp', () => {
    expect(visibleCheckInTabs(false)).toEqual(['scan', 'family', 'phones']);
  });
});

describe('resolveCheckInTab', () => {
  const visible = visibleCheckInTabs(false);

  it('opens the tab the URL names when it is visible', () => {
    expect(resolveCheckInTab('family', visible)).toBe('family');
    expect(resolveCheckInTab('phones', visible)).toBe('phones');
  });

  it('falls back to Scan or find when the tab is missing, unknown, repeated or hidden', () => {
    expect(resolveCheckInTab(undefined, visible)).toBe('scan');
    expect(resolveCheckInTab('nope', visible)).toBe('scan');
    expect(resolveCheckInTab(['family', 'phones'], visible)).toBe('scan');
    expect(resolveCheckInTab('link', visible)).toBe('scan');
  });

  it('defaults to the first tab in the list', () => {
    expect(CHECK_IN_TABS[0]).toBe('scan');
  });
});
