// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RegistrationForm } from '@buxa/contracts';
import { FormViewDialog } from '../FormViewDialog';
import { NewRegistrationFormButton } from '../NewRegistrationFormButton';
import { FormRowActions } from '../FormRowActions';
import { popUpMarkup } from './popUpMarkup';

vi.mock('@/actions/registration', () => ({
  createFormAction: vi.fn(),
  updateFormAction: vi.fn(),
  publishFormAction: vi.fn(),
  removeFormFileAction: vi.fn(),
}));
vi.mock('@buxa/middleware/providers/UiProvider', () => ({ useUi: () => ({ toast: vi.fn() }) }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SUMMER = { id: '11111111-1111-4111-8111-111111111111', name: 'Summer camp' };
const AUTUMN = { id: '22222222-2222-4222-8222-222222222222', name: 'Autumn camp' };
const SESSIONS = [SUMMER, AUTUMN];

const form: RegistrationForm = {
  id: '88888888-8888-4888-8888-888888888888',
  name: 'Season form',
  season: 'Summer 2027',
  sessions: [SUMMER],
  fields: [
    { key: 'allergies', label: 'Allergies', kind: 'text', required: false },
    { key: 'swim', label: 'Can swim', kind: 'yes_no', required: true },
    { key: 'lunch', label: 'Lunch', kind: 'choice', required: false, options: ['Hot', 'Packed'] },
  ],
  attachments: [{ id: 'file-1', name: 'Immunization.pdf', contentType: 'application/pdf', sizeBytes: 1000 }],
  publishedVersion: 2,
  published: {
    version: 2,
    name: 'Season form',
    season: 'Summer 2027',
    sessions: [SUMMER],
    fields: [
      { key: 'allergies', label: 'Allergies', kind: 'text', required: false },
      { key: 'swim', label: 'Can swim', kind: 'yes_no', required: true },
      { key: 'lunch', label: 'Lunch', kind: 'choice', required: false, options: ['Hot', 'Packed'] },
    ],
  },
  hasUnpublishedChanges: false,
  submissionCount: 3,
  updatedAt: '2027-06-01T00:00:00.000Z',
};

/** The close animation runs for about 190 ms before the pop-up leaves the page. */
const settle = (ms = 250) => act(() => new Promise<void>(resolve => setTimeout(resolve, ms)));

describe('the View pop-up, read only (rendered markup)', () => {
  it('shows the name, sessions, questions and files families download', () => {
    const html = popUpMarkup(
      <FormViewDialog form={form} canEdit canSubmit onEdit={() => undefined} onClose={() => undefined} />,
    );
    expect(html).toContain('Season form');
    expect(html).toContain('Summer camp');
    expect(html).toContain('Allergies');
    expect(html).toContain('Can swim');
    expect(html).toContain('Immunization.pdf');
    expect(html).toContain(`/camp/registration/files/file-1?session=${SUMMER.id}`);
  });

  it('has no input to change anything: no form, no field, no Save draft', () => {
    const html = popUpMarkup(
      <FormViewDialog form={form} canEdit canSubmit onEdit={() => undefined} onClose={() => undefined} />,
    );
    expect(html).not.toContain('<form');
    expect(html).not.toContain('<input');
    expect(html).not.toContain('Save draft');
  });

  it('offers Edit form only when the viewer may manage forms', () => {
    const manager = popUpMarkup(
      <FormViewDialog form={form} canEdit canSubmit onEdit={() => undefined} onClose={() => undefined} />,
    );
    const viewer = popUpMarkup(
      <FormViewDialog form={form} canEdit={false} canSubmit onEdit={() => undefined} onClose={() => undefined} />,
    );
    expect(manager).toContain('Edit form');
    expect(viewer).not.toContain('Edit form');
  });

  it('offers no file download to a viewer who may not take registrations', () => {
    const html = popUpMarkup(
      <FormViewDialog
        form={form}
        canEdit={false}
        canSubmit={false}
        onEdit={() => undefined}
        onClose={() => undefined}
      />,
    );
    expect(html).toContain('Immunization.pdf');
    expect(html).not.toContain('/camp/registration/files/');
  });

  it('shows covered sessions as tags with no remove control, and lists in plain rows', () => {
    const html = popUpMarkup(
      <FormViewDialog form={form} canEdit canSubmit onEdit={() => undefined} onClose={() => undefined} />,
    );
    expect(html).toContain('session-tag session-tag--static');
    expect(html).not.toContain('Remove Summer camp');
    expect(html).toContain('form-view__row');
    expect(html).not.toContain('form-file');
  });

  it('shows the empty states for sessions and files', () => {
    const empty: RegistrationForm = {
      ...form,
      sessions: [],
      attachments: [],
      published: form.published && { ...form.published, sessions: [] },
    };
    const html = popUpMarkup(
      <FormViewDialog form={empty} canEdit canSubmit onEdit={() => undefined} onClose={() => undefined} />,
    );
    expect(html).toContain('No sessions yet.');
    expect(html).toContain('No files yet.');
  });
});

describe('the Registration page pop-ups in the browser', () => {
  let root: Root;
  let host: HTMLDivElement;

  beforeEach(() => {
    host = document.body.appendChild(document.createElement('div'));
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  const button = (label: string) =>
    Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === label) ?? null;
  const viewButton = () => document.querySelector<HTMLButtonElement>('button[aria-label="View Season form"]');

  it('View form opens the read-only pop-up with the questions and files', () => {
    act(() => {
      root.render(<FormRowActions form={form} sessions={SESSIONS} canEdit canSubmit />);
    });
    act(() => {
      viewButton()?.click();
    });
    expect(document.body.textContent).toContain('Allergies');
    expect(document.body.textContent).toContain('Immunization.pdf');
    expect(button('Edit form')).not.toBeNull();
    expect(document.querySelector('input[name="name"]')).toBeNull();
  });

  it('Edit from View opens the edit pop-up for a manager, and closes the view', async () => {
    act(() => {
      root.render(<FormRowActions form={form} sessions={SESSIONS} canEdit canSubmit />);
    });
    act(() => {
      viewButton()?.click();
    });
    act(() => {
      button('Edit form')?.click();
    });
    await settle();
    expect(document.body.textContent).toContain('Edit registration form');
    expect(button('Save draft')).not.toBeNull();
    expect(button('Close')).toBeNull();
    const name = document.querySelector<HTMLInputElement>('input[name="name"]');
    expect(name?.value).toBe('Season form');
  });

  it('a viewer who may not manage forms has no Edit form button, so no edit pop-up can open', () => {
    act(() => {
      root.render(<FormRowActions form={form} sessions={SESSIONS} canEdit={false} canSubmit={false} />);
    });
    act(() => {
      viewButton()?.click();
    });
    expect(button('Edit form')).toBeNull();
    expect(document.body.textContent).toContain('Allergies');
  });

  it('New Form opens the create pop-up, and Cancel closes it without saving', async () => {
    act(() => {
      root.render(<NewRegistrationFormButton sessions={SESSIONS} />);
    });
    act(() => {
      button('New Form')?.click();
    });
    expect(document.body.textContent).toContain('New registration form');
    expect(button('Create form')).not.toBeNull();
    act(() => {
      button('Cancel')?.click();
    });
    await settle();
    expect(button('Create form')).toBeNull();
  });
});
