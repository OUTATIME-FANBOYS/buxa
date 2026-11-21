// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NewPersonForm } from '@/components/components/people/forms';
import { UiProvider } from '@buxa/middleware/providers/UiProvider';
import { Dialog as ConfirmDialog } from '@/components/components';
import { settle } from '@buxa/domain';

vi.mock('@buxa/server/composers/people/createPersonAction', () => ({
  createPersonAction: () => settle(() => ({ status: 'idle' })),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('NewPersonForm: the invite button by role', () => {
  let root: Root;
  let host: HTMLDivElement;
  beforeEach(() => {
    host = document.body.appendChild(document.createElement('div'));
    root = createRoot(host);
    act(() => {
      root.render(
        <UiProvider Dialog={ConfirmDialog}>
          <NewPersonForm household={null} households={[]} variant="dialog" formId="new-person-form" />
        </UiProvider>,
      );
    });
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  const click = (value: string) =>
    act(() => host.querySelector<HTMLInputElement>(`input[name="roles"][value="${value}"]`)?.click());
  const sendButton = () => Array.from(host.querySelectorAll('button')).find(b => b.textContent === 'Send invite');

  it('an instructor gets an enabled Send invite beside the Email field', () => {
    click('instructor');

    expect(sendButton()).toBeDefined();
    expect(sendButton()?.disabled).toBe(false);
    expect(host.textContent).not.toContain('Invites for this role are coming soon.');
  });

  it('another role gets a disabled Send invite with the coming-soon note', () => {
    click('participant');

    expect(sendButton()?.disabled).toBe(true);
    expect(host.textContent).toContain('Invites for this role are coming soon.');
  });

  it('a family role gets the disabled coming-soon invite beside its household Email', () => {
    click('camper');

    expect(sendButton()?.disabled).toBe(true);
    expect(host.textContent).toContain('Invites for this role are coming soon.');
  });
});
