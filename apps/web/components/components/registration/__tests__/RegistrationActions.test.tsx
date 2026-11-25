// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RegistrationActions } from '../RegistrationActions';

vi.mock('@/actions/registration', () => ({
  confirmRegistrationAction: vi.fn(),
  recordPaymentAction: vi.fn(),
  withdrawRegistrationAction: vi.fn(),
  archiveRegistrationAction: vi.fn(),
  unarchiveRegistrationAction: vi.fn(),
  deleteRegistrationAction: vi.fn(),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** The close animation runs for about 190 ms before the pop-up leaves the page. */
const settle = (ms = 250) => act(() => new Promise<void>(resolve => setTimeout(resolve, ms)));

describe('the icon actions on a registration row, in the browser', () => {
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

  const byLabel = (label: string) => document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);

  const renderRow = (
    props: { status?: 'pending' | 'confirmed' | 'withdrawn'; archived?: boolean; canDelete?: boolean } = {},
  ) => {
    act(() => {
      root.render(
        <RegistrationActions
          formId="form-1"
          registrationId="reg-1"
          camperName="Ada Lovelace"
          status={props.status ?? 'pending'}
          archived={props.archived ?? false}
          canDelete={props.canDelete ?? false}
        />,
      );
    });
  };

  it('names each icon button for the camper and gives it a tooltip', () => {
    renderRow({ canDelete: true });

    expect(byLabel('Withdraw Ada Lovelace')?.title).toBe('Withdraw registration');
    expect(byLabel('Archive Ada Lovelace')?.title).toBe('Archive registration');
    expect(byLabel('Delete Ada Lovelace')?.title).toBe('Delete registration');
  });

  it('shows Unarchive for an archived registration, named for the camper', () => {
    renderRow({ archived: true });

    expect(byLabel('Unarchive Ada Lovelace')).not.toBeNull();
    expect(byLabel('Archive Ada Lovelace')).toBeNull();
  });

  it('opens the Withdraw confirmation, and Cancel closes it without withdrawing', async () => {
    renderRow();
    act(() => {
      byLabel('Withdraw Ada Lovelace')?.click();
    });
    expect(document.body.textContent).toContain('Withdraw registration?');

    const cancel = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Cancel');
    act(() => {
      cancel?.click();
    });
    await settle();

    expect(document.body.textContent).not.toContain('Withdraw registration?');
  });

  it('opens the Delete confirmation for an admin, with the same warning as before', () => {
    renderRow({ canDelete: true });
    act(() => {
      byLabel('Delete Ada Lovelace')?.click();
    });

    expect(document.body.textContent).toContain('Delete registration?');
    expect(document.body.textContent).toContain('This cannot be undone.');
  });

  it('shows no Delete for a staff member who may not delete', () => {
    renderRow({ canDelete: false });

    expect(byLabel('Delete Ada Lovelace')).toBeNull();
  });

  it('puts Archive in a form that submits at once, with no confirmation, as before', () => {
    renderRow();

    expect(document.body.textContent).not.toContain('Archive registration?');
    const hidden =
      byLabel('Archive Ada Lovelace')?.form?.querySelector<HTMLInputElement>('input[name="registrationId"]');
    expect(hidden?.value).toBe('reg-1');
  });
});
