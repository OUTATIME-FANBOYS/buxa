// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RegistrationForm } from '@buxa/contracts';
import { success } from '@buxa/shared';
import { RegistrationFormDialog } from '../RegistrationFormDialog';
import { popUpMarkup } from './popUpMarkup';

const actions = vi.hoisted(() => ({
  createFormAction: vi.fn(),
  updateFormAction: vi.fn(),
  publishFormAction: vi.fn(),
  removeFormFileAction: vi.fn(),
}));
const toast = vi.hoisted(() => vi.fn());

vi.mock('@/actions/registration', () => actions);
vi.mock('@buxa/middleware/providers/UiProvider', () => ({ useUi: () => ({ toast }) }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SUMMER = { id: '11111111-1111-4111-8111-111111111111', name: 'Summer camp' };
const AUTUMN = { id: '22222222-2222-4222-8222-222222222222', name: 'Autumn camp' };
const SESSIONS = [SUMMER, AUTUMN];
const FORM_ID = '88888888-8888-4888-8888-888888888888';

const form: RegistrationForm = {
  id: FORM_ID,
  name: 'Season form',
  season: '2027',
  sessions: [SUMMER],
  fields: [{ key: 'allergies', label: 'Allergies', kind: 'text', required: false }],
  attachments: [{ id: 'file-1', name: 'Immunization.pdf', contentType: 'application/pdf', sizeBytes: 1000 }],
  publishedVersion: 1,
  published: {
    version: 1,
    name: 'Season form',
    season: '2027',
    sessions: [SUMMER],
    fields: [{ key: 'allergies', label: 'Allergies', kind: 'text', required: false }],
  },
  hasUnpublishedChanges: false,
  submissionCount: 0,
  updatedAt: '2027-06-01T00:00:00.000Z',
};

describe('RegistrationFormDialog: the pop-up for a new form (rendered markup)', () => {
  it('titles the pop-up New registration form, with Create form as its one action', () => {
    const html = popUpMarkup(<RegistrationFormDialog mode="create" sessions={SESSIONS} onClose={() => undefined} />);
    expect(html).toContain('New registration form');
    expect(html).toContain('Create form');
    expect(html).not.toContain('Save draft');
    expect(html).not.toContain('Publish');
  });

  it('has no Season field and no season hint', () => {
    const html = popUpMarkup(<RegistrationFormDialog mode="create" sessions={SESSIONS} onClose={() => undefined} />);
    expect(html).not.toContain('Season');
    expect(html).not.toContain('name="season"');
    expect(html).not.toContain('Only for your own reference');
  });
});

describe('RegistrationFormDialog: edit opens prefilled (rendered markup)', () => {
  it('fills the name, sessions and questions from the form, and has no Season field', () => {
    const html = popUpMarkup(
      <RegistrationFormDialog mode="edit" form={form} sessions={SESSIONS} onClose={() => undefined} />,
    );
    expect(html).toContain('Edit registration form');
    expect(html).toContain('value="Season form"');
    expect(html).not.toContain('name="season"');
    expect(html).not.toContain('value="2027"');
    expect(html).toContain('Allergies');
    expect(html).toContain('Immunization.pdf');
  });

  it('offers Save draft beside the primary Publish, and Cancel', () => {
    const html = popUpMarkup(
      <RegistrationFormDialog mode="edit" form={form} sessions={SESSIONS} onClose={() => undefined} />,
    );
    expect(html).toContain('Save draft');
    expect(html).toContain('Publish a new version');
    expect(html).toContain('Cancel');
  });

  it('says Publish form, not a new version, while the form is a draft', () => {
    const html = popUpMarkup(
      <RegistrationFormDialog
        mode="edit"
        form={{ ...form, publishedVersion: null }}
        sessions={SESSIONS}
        onClose={() => undefined}
      />,
    );
    expect(html).toContain('Publish form');
    expect(html).not.toContain('Publish a new version');
  });
});

describe('RegistrationFormDialog: saving in the browser', () => {
  let root: Root;
  let host: HTMLDivElement;

  beforeEach(() => {
    vi.clearAllMocks();
    host = document.body.appendChild(document.createElement('div'));
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  const button = (label: string) =>
    Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === label) ?? null;
  // Lets React finish the action and its state update, so the effects that close the pop-up have run.
  const settle = () => act(() => new Promise<void>(resolve => setTimeout(resolve, 0)));

  it('New form saves: the action runs, the pop-up closes and a toast says so', async () => {
    actions.createFormAction.mockResolvedValue(success('Registration form created.'));
    const onClose = vi.fn();
    act(() => {
      root.render(<RegistrationFormDialog mode="create" sessions={SESSIONS} onClose={onClose} />);
    });
    const submit = button('Create form');
    expect(submit).not.toBeNull();
    const target = document.querySelector('form.registration-editor');
    expect(submit?.getAttribute('form')).toBe(target?.id);

    act(() => {
      submit?.click();
    });
    await settle();
    expect(actions.createFormAction).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith('Registration form created.');
    expect(onClose).toHaveBeenCalled();
  });

  it('Save draft on an edit saves the draft and closes, without publishing', async () => {
    actions.updateFormAction.mockResolvedValue(
      success('Saved. Publish the form to use these questions for registrations.'),
    );
    const onClose = vi.fn();
    act(() => {
      root.render(<RegistrationFormDialog mode="edit" form={form} sessions={SESSIONS} onClose={onClose} />);
    });
    act(() => {
      button('Save draft')?.click();
    });
    await settle();
    expect(actions.updateFormAction).toHaveBeenCalledTimes(1);
    expect(actions.publishFormAction).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('Publish a new version publishes the form by its id and closes with the server message', async () => {
    const seen = { formId: '' };
    actions.publishFormAction.mockImplementation((_previous: unknown, data: FormData) => {
      const formId = data.get('formId');
      seen.formId = typeof formId === 'string' ? formId : '';

      return Promise.resolve(success('Published as version 2. Families can now register on it.'));
    });
    const onClose = vi.fn();
    act(() => {
      root.render(<RegistrationFormDialog mode="edit" form={form} sessions={SESSIONS} onClose={onClose} />);
    });
    act(() => {
      button('Publish a new version')?.click();
    });
    await settle();
    expect(actions.publishFormAction).toHaveBeenCalledTimes(1);
    expect(seen.formId).toBe(FORM_ID);
    expect(toast).toHaveBeenCalledWith('Published as version 2. Families can now register on it.');
    expect(onClose).toHaveBeenCalled();
  });
});
