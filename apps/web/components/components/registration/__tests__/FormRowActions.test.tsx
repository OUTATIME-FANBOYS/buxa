import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { RegistrationForm } from '@buxa/contracts';
import { FORM_HAS_REGISTRATIONS_MESSAGE } from '@buxa/domain';
import { FormRowActions } from '../FormRowActions';
import { FormViewDialog } from '../FormViewDialog';
import { DeleteFormDialog } from '../DeleteFormDialog';

vi.mock('@/actions/registration', () => ({
  createFormAction: vi.fn(),
  updateFormAction: vi.fn(),
  publishFormAction: vi.fn(),
  removeFormFileAction: vi.fn(),
  deleteFormAction: vi.fn(),
}));
vi.mock('@buxa/middleware/providers/UiProvider', () => ({ useUi: () => ({ toast: vi.fn() }) }));

const SUMMER = { id: '11111111-1111-4111-8111-111111111111', name: 'Summer camp' };
const SESSIONS = [SUMMER];

const form: RegistrationForm = {
  id: '88888888-8888-4888-8888-888888888888',
  name: 'Season form',
  season: 'Summer 2027',
  sessions: [SUMMER],
  fields: [
    { key: 'allergies', label: 'Allergies', kind: 'text', required: false },
    { key: 'lunch', label: 'Lunch', kind: 'choice', required: false, options: ['Hot', 'Packed'] },
  ],
  attachments: [{ id: 'file-1', name: 'Immunization.pdf', contentType: 'application/pdf', sizeBytes: 2048 }],
  publishedVersion: 2,
  submissionCount: 0,
  updatedAt: '2027-06-01T00:00:00.000Z',
};

/** The opening tag of the button named `label`, so its attributes can be checked on their own. */
const buttonTag = (html: string, label: string): string => {
  const match = html.match(new RegExp(`<button[^>]*aria-label="${label}"[^>]*>`));

  return match ? match[0] : '';
};

const row = (overrides: Partial<RegistrationForm> = {}, canEdit = true) =>
  renderToStaticMarkup(
    <FormRowActions form={{ ...form, ...overrides }} sessions={SESSIONS} canEdit={canEdit} canSubmit />,
  );

describe('the three icon buttons on a forms row', () => {
  it('names View, Edit and Delete for the form, each with its icon and a tooltip', () => {
    const html = row();
    expect(buttonTag(html, 'View Season form')).toContain('title="View form"');
    expect(buttonTag(html, 'Edit Season form')).toContain('title="Edit form"');
    expect(buttonTag(html, 'Delete Season form')).toContain('title="Delete form"');
    expect(html).toContain('lucide-eye');
    expect(html).toContain('lucide-pencil');
    expect(html).toContain('lucide-trash-2');
  });

  it('puts them in the order View, Edit, Delete', () => {
    const html = row();
    const view = html.indexOf('aria-label="View Season form"');
    const edit = html.indexOf('aria-label="Edit Season form"');
    const remove = html.indexOf('aria-label="Delete Season form"');
    expect(view).toBeGreaterThan(-1);
    expect(edit).toBeGreaterThan(view);
    expect(remove).toBeGreaterThan(edit);
  });

  it('shows View to everyone who sees the page, and hides Edit and Delete without registration:manage', () => {
    const html = row({}, false);
    expect(html).toContain('aria-label="View Season form"');
    expect(html).not.toContain('aria-label="Edit Season form"');
    expect(html).not.toContain('aria-label="Delete Season form"');
  });

  it('enables Delete when the form has no registrations', () => {
    expect(buttonTag(row({ submissionCount: 0 }), 'Delete Season form')).not.toContain('disabled');
  });

  it('disables Delete, rather than hiding it, when the form has registrations, and says why', () => {
    const tag = buttonTag(row({ submissionCount: 3 }), 'Delete Season form');
    expect(tag).not.toBe('');
    expect(tag).toContain('disabled');
    expect(tag).toContain(`title="${FORM_HAS_REGISTRATIONS_MESSAGE}"`);
  });
});

describe('the read-only View pop-up', () => {
  const view = (canEdit: boolean) =>
    renderToStaticMarkup(
      <FormViewDialog form={form} canEdit={canEdit} canSubmit onEdit={() => undefined} onClose={() => undefined} />,
    );

  it('lists each question with its type, whether it is required, and its options', () => {
    const html = view(true);
    expect(html).toContain('Allergies');
    expect(html).toContain('Text · Optional');
    expect(html).toContain('Lunch');
    expect(html).toContain('Choice · Optional');
    expect(html).toContain('Options: Hot, Packed');
  });

  it('lists each file with its name and size', () => {
    const html = view(true);
    expect(html).toContain('Immunization.pdf');
    expect(html).toContain('2 KB');
  });

  it('keeps Edit form in the footer for a manager only, with its icon', () => {
    expect(view(true)).toContain('Edit form');
    expect(view(true)).toContain('lucide-pencil');
    expect(view(false)).not.toContain('Edit form');
  });
});

describe('the delete confirmation', () => {
  const html = renderToStaticMarkup(<DeleteFormDialog form={form} onClose={() => undefined} />);

  it('names the form and says it cannot be undone', () => {
    expect(html).toContain('Delete form?');
    expect(html).toContain('Season form');
    expect(html).toContain('This cannot be undone.');
  });

  it('keeps Cancel before the Delete button, both on the right of the footer', () => {
    expect(html.indexOf('>Cancel<')).toBeGreaterThan(-1);
    expect(html.indexOf('>Cancel<')).toBeLessThan(html.indexOf('>Delete form<'));
  });

  it('carries the form id as a hidden field for the server', () => {
    expect(html).toContain(`name="formId" value="${form.id}"`);
  });
});
