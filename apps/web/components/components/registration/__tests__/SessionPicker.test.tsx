// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FormEditor } from '../FormEditor';

vi.mock('@/actions/registration', () => ({
  createFormAction: vi.fn(),
  updateFormAction: vi.fn(),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ART = { id: '11111111-1111-4111-8111-111111111111', name: 'Art' };
const ROBOTICS = { id: '22222222-2222-4222-8222-222222222222', name: 'Robotics' };
const SWIM = { id: '33333333-3333-4333-8333-333333333333', name: 'Swim' };
const SESSIONS = [ART, ROBOTICS, SWIM];

describe('FormEditor: sessions this form covers as tags', () => {
  let root: Root;
  let host: HTMLDivElement;

  beforeEach(() => {
    host = document.body.appendChild(document.createElement('div'));
    root = createRoot(host);
    act(() => {
      root.render(<FormEditor mode="create" variant="dialog" id="form-under-test" sessions={SESSIONS} />);
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  const form = () => {
    const found = host.querySelector('form');
    if (!found) {
      throw new Error('no form');
    }

    return found;
  };
  const choose = (id: string) => {
    const select = host.querySelector<HTMLSelectElement>('select.session-picker__input');
    if (!select) {
      throw new Error('no session select');
    }
    act(() => {
      select.value = id;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
  };
  const tagNames = () =>
    Array.from(host.querySelectorAll<HTMLButtonElement>('button.session-tag')).map(b => b.getAttribute('aria-label'));
  const submittedSessionIds = () => new FormData(form()).getAll('sessionIds');

  it('starts with no tags, so the form posts no session ids', () => {
    expect(tagNames()).toEqual([]);
    expect(submittedSessionIds()).toEqual([]);
  });

  it('adds each chosen session as a tag, removes one with its x, and submits the rest', () => {
    choose(ART.id);
    choose(ROBOTICS.id);
    expect(tagNames()).toEqual(['Remove Art', 'Remove Robotics']);
    expect(submittedSessionIds()).toEqual([ART.id, ROBOTICS.id]);

    const remove = host.querySelector<HTMLButtonElement>('button[aria-label="Remove Art"]');
    act(() => remove?.click());

    expect(tagNames()).toEqual(['Remove Robotics']);
    expect(submittedSessionIds()).toEqual([ROBOTICS.id]);
  });

  it('offers only the sessions not yet chosen in the select', () => {
    choose(ART.id);
    const options = Array.from(host.querySelectorAll<HTMLOptionElement>('select.session-picker__input option'))
      .map(o => o.textContent)
      .filter(Boolean);
    expect(options).toEqual(['Add a session', 'Robotics', 'Swim']);
  });
});
