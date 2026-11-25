// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RegistrationForm } from '@buxa/contracts';
import { FormRowActions } from '../FormRowActions';

const toast = vi.hoisted(() => vi.fn());

vi.mock('@/actions/registration', async () => {
  const { success } = await import('@buxa/shared');

  return {
    createFormAction: vi.fn(),
    updateFormAction: vi.fn(),
    publishFormAction: vi.fn(),
    removeFormFileAction: vi.fn(),
    deleteFormAction: () => Promise.resolve(success('Form deleted.')),
  };
});
vi.mock('@buxa/middleware/providers/UiProvider', () => ({ useUi: () => ({ toast }) }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SUMMER = { id: '11111111-1111-4111-8111-111111111111', name: 'Summer camp' };
const FORM_ID = '88888888-8888-4888-8888-888888888888';

const form: RegistrationForm = {
  id: FORM_ID,
  name: 'Season form',
  season: 'Summer 2027',
  sessions: [SUMMER],
  fields: [],
  attachments: [],
  publishedVersion: null,
  submissionCount: 0,
  updatedAt: '2027-06-01T00:00:00.000Z',
};

/** The close animation runs for about 190 ms before the pop-up leaves the page. */
const settle = (ms = 250) => act(() => new Promise<void>(resolve => setTimeout(resolve, ms)));

describe('deleting a form from its row, in the browser', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    toast.mockClear();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  const byLabel = (label: string) => document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);

  it('opens a confirmation that names the form, and a successful delete closes it with a toast', async () => {
    act(() => {
      root.render(<FormRowActions form={form} sessions={[SUMMER]} canEdit canSubmit={false} />);
    });
    act(() => {
      byLabel('Delete Season form')?.click();
    });
    expect(document.body.textContent).toContain('Delete form?');
    expect(document.body.textContent).toContain('Season form');

    act(() => {
      document.querySelector<HTMLFormElement>(`form#delete-form-${FORM_ID}`)?.requestSubmit();
    });
    await settle();

    expect(toast).toHaveBeenCalledWith('Form deleted.');
    expect(document.body.textContent).not.toContain('Delete form?');
  });

  it('Cancel closes the confirmation and deletes nothing', async () => {
    act(() => {
      root.render(<FormRowActions form={form} sessions={[SUMMER]} canEdit canSubmit={false} />);
    });
    act(() => {
      byLabel('Delete Season form')?.click();
    });
    const cancel = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Cancel');
    act(() => {
      cancel?.click();
    });
    await settle();

    expect(document.body.textContent).not.toContain('Delete form?');
    expect(toast).not.toHaveBeenCalled();
  });
});
