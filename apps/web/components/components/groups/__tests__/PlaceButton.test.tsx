// @vitest-environment jsdom
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UiProvider } from '@buxa/middleware/providers/providers';
import { PlaceButton } from '../PlaceButton';
import type { AssignChoices } from '../AssignDialog';

vi.mock('@/actions/groups', () => ({ assignAction: vi.fn(), unassignAction: vi.fn() }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const ADA = '22222222-2222-4222-8222-222222222222';

const choices: AssignChoices = {
  sessionId: SESSION_ID,
  campers: [{ id: ADA, name: 'Ada Lovelace' }],
  staff: [],
  groups: [],
  rooms: [],
};

let mounted: { root: Root; container: HTMLElement } | null = null;

function mount(element: ReactElement): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<UiProvider>{element}</UiProvider>);
  });
  mounted = { root, container };

  return container;
}

afterEach(() => {
  if (mounted) {
    act(() => {
      mounted?.root.unmount();
    });
    mounted.container.remove();
    mounted = null;
  }
});

describe('PlaceButton', () => {
  it('renders the label and the accessible name the row passes', () => {
    const container = mount(<PlaceButton choices={choices} personId={ADA} accessibleName="Place Ada Lovelace" />);
    const button = container.querySelector('button');

    expect(button?.textContent).toBe('Place');
    expect(button?.getAttribute('aria-label')).toBe('Place Ada Lovelace');
    expect(button?.getAttribute('type')).toBe('button');
  });

  it('uses the label the header passes', () => {
    const container = mount(<PlaceButton choices={choices} label="Place or move" />);

    expect(container.querySelector('button')?.textContent).toBe('Place or move');
    expect(container.querySelector('button')?.hasAttribute('aria-label')).toBe(false);
  });

  it('opens the Place or move pop-up when clicked', () => {
    const container = mount(<PlaceButton choices={choices} personId={ADA} />);

    expect(document.body.textContent).not.toContain('Place or move a person');
    act(() => {
      container.querySelector('button')?.click();
    });
    expect(document.body.textContent).toContain('Place or move a person');
  });
});
