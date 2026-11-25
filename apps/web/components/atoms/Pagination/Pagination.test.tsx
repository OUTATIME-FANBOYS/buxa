// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { Pagination } from './Pagination';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const twentyThree = Array.from({ length: 23 }, (_, index) => `Camper ${index + 1}`);

let mounted: { root: Root; container: HTMLElement } | null = null;

afterEach(() => {
  if (mounted) {
    act(() => {
      mounted?.root.unmount();
    });
    mounted.container.remove();
    mounted = null;
  }
});

/** Renders the pager with a list of names, the way UnplacedCampers does. `resetKey` is the search text in the real list. */
function renderPager(items: readonly string[], resetKey = ''): HTMLElement {
  const container = mounted?.container ?? document.createElement('div');
  if (!mounted) {
    document.body.appendChild(container);
    mounted = { root: createRoot(container), container };
  }
  const { root } = mounted;
  act(() => {
    root.render(
      <Pagination items={items} resetKey={resetKey} label="Pages of campers">
        {pageItems => (
          <ul>
            {pageItems.map(name => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        )}
      </Pagination>,
    );
  });

  return container;
}

function button(container: HTMLElement, name: string): HTMLButtonElement {
  const found = container.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`);
  if (!found) {
    throw new Error(`no ${name} button`);
  }

  return found;
}

function clickButton(container: HTMLElement, name: string): void {
  act(() => {
    button(container, name).click();
  });
}

function shownNames(container: HTMLElement): string[] {
  return [...container.querySelectorAll('li')].map(li => li.textContent ?? '');
}

describe('Pagination', () => {
  it('shows the first 10 items with the status line, and disables Previous on page 1', () => {
    const container = renderPager(twentyThree);

    expect(shownNames(container)).toHaveLength(10);
    expect(container.textContent).toContain('Showing 1–10 of 23');
    expect(button(container, 'Previous page').disabled).toBe(true);
    expect(button(container, 'Next page').disabled).toBe(false);
  });

  it('shows 11 to 20 of 23 on page 2', () => {
    const container = renderPager(twentyThree);

    clickButton(container, 'Next page');

    expect(shownNames(container)).toEqual(Array.from({ length: 10 }, (_, index) => `Camper ${index + 11}`));
    expect(container.textContent).toContain('Showing 11–20 of 23');
    expect(button(container, 'Previous page').disabled).toBe(false);
  });

  it('disables Next on the last page, which holds the three remaining items', () => {
    const container = renderPager(twentyThree);

    clickButton(container, 'Next page');
    clickButton(container, 'Next page');

    expect(shownNames(container)).toEqual(['Camper 21', 'Camper 22', 'Camper 23']);
    expect(container.textContent).toContain('Showing 21–23 of 23');
    expect(button(container, 'Next page').disabled).toBe(true);
    expect(button(container, 'Previous page').disabled).toBe(false);
  });

  it('returns to page 1 when the reset key (the search text) changes', () => {
    const container = renderPager(twentyThree, '');
    clickButton(container, 'Next page');

    renderPager(twentyThree, 'camper 1');

    expect(container.textContent).toContain('Showing 1–10 of 23');
    expect(button(container, 'Previous page').disabled).toBe(true);
  });

  it('shows no pagination when the items fit on one page', () => {
    const container = renderPager(twentyThree.slice(0, 10));

    expect(shownNames(container)).toHaveLength(10);
    expect(container.querySelector('nav')).toBeNull();
    expect(container.querySelector('button[aria-label="Next page"]')).toBeNull();
  });

  it('gives the status line a polite live region and names the controls', () => {
    const container = renderPager(twentyThree);
    const status = container.querySelector('[aria-live]');

    expect(status?.getAttribute('aria-live')).toBe('polite');
    expect(container.querySelector('nav')?.getAttribute('aria-label')).toBe('Pages of campers');
  });
});
