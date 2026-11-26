// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { PersonForm } from '@/components/components/people/forms';
import { UiProvider } from '@buxa/middleware/providers/UiProvider';
import { ConfirmDialog } from '@/components/components';
import { settle } from '@buxa/domain';
import { inviteProblem } from '@/components/components/people/forms/PersonInvite';

vi.mock('@buxa/server/composers/people/createPersonAction', () => ({
  createPersonAction: () => settle(() => ({ status: 'idle' })),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('PersonForm (create): the invite button by role', () => {
  let root: Root;
  let host: HTMLDivElement;
  beforeEach(() => {
    host = document.body.appendChild(document.createElement('div'));
    root = createRoot(host);
    act(() => {
      root.render(
        <UiProvider Dialog={ConfirmDialog}>
          <PersonForm mode="create" household={null} households={[]} variant="dialog" formId="new-person-form" />
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

  const type = (name: string, value: string) =>
    act(() => {
      const input = host.querySelector<HTMLInputElement>(`input[name="${name}"]`);
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
      input?.dispatchEvent(new Event('input', { bubbles: true }));
    });

  it('an instructor gets a Send invite beside the Email field, disabled until the email is valid', () => {
    click('instructor');

    expect(sendButton()).toBeDefined();
    // Empty email: the invite waits.
    expect(sendButton()?.disabled).toBe(true);
    type('email', 'not-an-email');
    expect(sendButton()?.disabled).toBe(true);
    type('email', 'teacher@example.com');
    expect(sendButton()?.disabled).toBe(false);
    expect(host.textContent).not.toContain('Invites for this role are coming soon.');
  });

  it('the date of birth and phone sit beside each other, both marked required, above the invite', () => {
    const pair = host.querySelector('.form-pair');

    expect(pair?.textContent).toContain('Date of birth');
    expect(pair?.textContent).toContain('Phone');
    expect(pair?.querySelectorAll('.field-required')).toHaveLength(2);
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

describe('PersonInvite: the details are checked before the invite is sent', () => {
  const details = { name: 'Ann Lee', email: 'ann@example.test', phone: '+61 400 000 000', dateOfBirth: '1985-06-15' };

  it('passes when the phone and date of birth are given', () => {
    expect(inviteProblem(details)).toBeUndefined();
  });

  it('names a missing date of birth with the person form message', () => {
    expect(inviteProblem({ ...details, dateOfBirth: '' })).toBe('Enter the date of birth.');
  });

  it('names a missing phone with the person form message', () => {
    expect(inviteProblem({ ...details, phone: '' })).toBe('Enter a phone number with at least 7 digits.');
  });
});
