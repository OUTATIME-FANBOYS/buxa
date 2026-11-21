// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { UiProvider } from '@buxa/middleware/providers/providers';
import { DeletedSessionToast } from '@/components/components/classes';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NoDialog = () => null;

describe('DeletedSessionToast', () => {
  let root: Root;
  beforeEach(() => {
    root = createRoot(document.body.appendChild(document.createElement('div')));
  });
  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = '';
  });

  it('shows Deleted "Name". once, as a status toast', () => {
    act(() => {
      root.render(
        <UiProvider Dialog={NoDialog}>
          <DeletedSessionToast name="Art" />
        </UiProvider>,
      );
    });
    expect(document.querySelector('[role="status"]')?.textContent).toContain('Deleted "Art".');
    expect(document.querySelectorAll('[role="status"]')).toHaveLength(1);
  });
});
