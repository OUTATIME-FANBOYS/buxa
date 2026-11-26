// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { OnSiteRowView } from '@buxa/shared';
import { OnSiteList } from '../OnSiteList';

vi.mock('../OnSiteRow', () => ({
  ON_SITE_LIST_ID: 'on-site-list',
  OnSiteRow: ({ row }: { row: OnSiteRowView }) => <li>{row.name}</li>,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const row = (personId: string, name: string): OnSiteRowView => ({
  personId,
  name,
  arrivedAt: '2027-07-01T19:46:00.000Z',
  isMinor: null,
  pickupOptions: [],
});

const rows = [row('1', 'Owen Adeyemi'), row('2', 'Mila Adeyemi'), row('3', 'Ben Hartley'), row('4', 'René Dubois')];

let root: Root;

beforeEach(() => {
  root = createRoot(document.body.appendChild(document.createElement('div')));
});

afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = '';
});

const names = () => Array.from(document.querySelectorAll('li')).map(li => li.textContent);

const type = (value: string) => {
  const input = document.querySelector<HTMLInputElement>('input[aria-label="Search people on site"]');
  if (!input) {
    throw new Error('the search box is missing');
  }
  // React tracks the value itself, so set it through the element's native setter and then fire the input event.
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  descriptor?.set?.call(input, value);
  act(() => {
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

describe('OnSiteList search', () => {
  it('renders the search box with its accessible label', () => {
    act(() =>
      root.render(
        <OnSiteList title="On site" subtitle="4 people on site now" rows={rows} canRecord canOverride={false} />,
      ),
    );
    const input = document.querySelector<HTMLInputElement>('input[aria-label="Search people on site"]');
    expect(input).not.toBeNull();
    expect(input?.getAttribute('placeholder')).toBe('Search by name');
  });

  it('lists everyone with an empty search box', () => {
    act(() =>
      root.render(
        <OnSiteList title="On site" subtitle="4 people on site now" rows={rows} canRecord canOverride={false} />,
      ),
    );
    expect(names()).toEqual(['Owen Adeyemi', 'Mila Adeyemi', 'Ben Hartley', 'René Dubois']);
  });

  it('filters by name as you type, ignoring case and accents', () => {
    act(() =>
      root.render(
        <OnSiteList title="On site" subtitle="4 people on site now" rows={rows} canRecord canOverride={false} />,
      ),
    );
    type('ADEY');
    expect(names()).toEqual(['Owen Adeyemi', 'Mila Adeyemi']);
    type('rene');
    expect(names()).toEqual(['René Dubois']);
  });

  it('shows a message when nobody matches', () => {
    act(() =>
      root.render(
        <OnSiteList title="On site" subtitle="4 people on site now" rows={rows} canRecord canOverride={false} />,
      ),
    );
    type('zzz');
    expect(names()).toEqual([]);
    expect(document.body.textContent).toContain('No one on site matches');
  });

  it('ignores spaces around the query', () => {
    act(() =>
      root.render(
        <OnSiteList title="On site" subtitle="4 people on site now" rows={rows} canRecord canOverride={false} />,
      ),
    );
    type('  ben  ');
    expect(names()).toEqual(['Ben Hartley']);
  });
});
