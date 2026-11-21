// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Dialog } from '@/components/components/Dialog';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('Dialog: the footer is pinned outside the scrolling body', () => {
  it('puts the footer after the body, as its own region, so a tall body cannot push it out of view', () => {
    act(() => {
      root.render(
        <Dialog title="New session" onClose={vi.fn()} footer={<button type="button">Create session</button>}>
          <p>Tall content</p>
        </Dialog>,
      );
    });
    const body = document.querySelector('.dialog-body');
    const foot = document.querySelector('.dialog-foot');
    expect(body).not.toBeNull();
    expect(foot).not.toBeNull();
    // The footer is a sibling of the body, not inside it: it is never part of the scroll area.
    expect(body?.contains(foot ?? null)).toBe(false);
    expect(foot?.parentElement).toBe(body?.parentElement);
    expect(foot?.textContent).toContain('Create session');
    expect(body?.textContent).not.toContain('Create session');
  });

  it('gives the body the room left over and lets only the body scroll', () => {
    act(() => {
      root.render(
        <Dialog title="Long" onClose={vi.fn()} footer={<button type="button">Save</button>}>
          <p>Lots</p>
        </Dialog>,
      );
    });
    const body = document.querySelector<HTMLElement>('.dialog-body');
    const foot = document.querySelector<HTMLElement>('.dialog-foot');
    expect(body?.className).toContain('overflow-y-auto');
    expect(body?.className).toContain('min-h-0');
    expect(body?.className).toContain('flex-1');
    expect(foot?.className).toContain('shrink-0');
  });

  it('renders no footer element when none is given', () => {
    act(() => {
      root.render(
        <Dialog title="Plain" onClose={vi.fn()}>
          <p>Only a body</p>
        </Dialog>,
      );
    });
    expect(document.querySelector('.dialog-foot')).toBeNull();
  });
});
