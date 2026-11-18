// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createDrag, justDragged } from '../cardDrag';

const deps = () => ({
  root: () => null,
  setDrag: vi.fn(),
  setOver: vi.fn(),
  latest: () => ({ moveTask: vi.fn(), tasks: [], manual: true, columns: [], toast: vi.fn() }),
  batch: (fn: () => void) => fn(),
});

describe('card drag', () => {
  it('is not active until a card is lifted, and no card counts as just dragged at start', () => {
    const drag = createDrag(deps());
    expect(drag.active()).toBe(false);
    expect(justDragged()).toBe(false);
    drag.destroy();
  });

  it('ignores a secondary mouse button, so a right click never starts a drag', () => {
    const drag = createDrag(deps());
    const el = document.createElement('article');
    document.body.appendChild(el);
    const event = {
      pointerType: 'mouse',
      button: 2,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      currentTarget: el,
    } as unknown as React.PointerEvent<HTMLElement>;
    drag.grab(event, 'task-1');
    expect(drag.active()).toBe(false);
    drag.destroy();
    el.remove();
  });

  it('removes any ghost left behind when destroyed', () => {
    const drag = createDrag(deps());
    const ghost = document.createElement('div');
    ghost.className = 'card-ghost';
    document.body.appendChild(ghost);
    drag.destroy();
    expect(document.querySelector('.card-ghost')).toBeNull();
  });
});
