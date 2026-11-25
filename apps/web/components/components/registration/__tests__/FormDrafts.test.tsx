import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { RegistrationForm } from '@buxa/contracts';
import { FormsTable } from '../FormsTable';
import { FormViewDialog } from '../FormViewDialog';
import { RegistrationFormDialog } from '../RegistrationFormDialog';

vi.mock('@/actions/registration', () => ({
  createFormAction: vi.fn(),
  updateFormAction: vi.fn(),
  publishFormAction: vi.fn(),
  removeFormFileAction: vi.fn(),
  deleteFormAction: vi.fn(),
}));
vi.mock('@buxa/middleware/providers/UiProvider', () => ({ useUi: () => ({ toast: vi.fn() }) }));

/*
 * Drafts and published versions (migration 0071). Staff see the draft in the edit pop-up, the published version in the view pop-up
 * and on the Registration table, and a note when the two differ. Server render only, like the other pop-up tests.
 */

const SUMMER = { id: '11111111-1111-4111-8111-111111111111', name: 'Summer camp' };
const AUTUMN = { id: '22222222-2222-4222-8222-222222222222', name: 'Autumn camp' };
const FORM_ID = '88888888-8888-4888-8888-888888888888';

const PHOTOS = { key: 'photos', label: 'Photo consent', kind: 'yes_no', required: true } as const;
const ALLERGIES = { key: 'allergies', label: 'Allergies', kind: 'text', required: false } as const;

/** A form whose draft has moved on from its published version 2. */
const drafted: RegistrationForm = {
  id: FORM_ID,
  name: 'Draft name',
  season: 'Summer 2028',
  sessions: [SUMMER, AUTUMN],
  fields: [ALLERGIES],
  attachments: [],
  publishedVersion: 2,
  published: {
    version: 2,
    name: 'Published name',
    season: 'Summer 2027',
    sessions: [SUMMER],
    fields: [PHOTOS],
  },
  hasUnpublishedChanges: true,
  submissionCount: 0,
  updatedAt: '2027-06-01T00:00:00.000Z',
};

const unchanged: RegistrationForm = {
  ...drafted,
  name: 'Published name',
  season: 'Summer 2027',
  sessions: [SUMMER],
  fields: [PHOTOS],
  hasUnpublishedChanges: false,
};

const neverPublished: RegistrationForm = {
  ...drafted,
  publishedVersion: null,
  published: null,
  hasUnpublishedChanges: false,
};

describe('the Registration table shows the published name and the unpublished note', () => {
  it('names the form and its season as published, and shows the note when the draft differs', () => {
    const html = renderToStaticMarkup(<FormsTable forms={[drafted]} sessions={[]} canEdit={false} canSubmit={false} />);
    expect(html).toContain('Published name');
    expect(html).toContain('Summer 2027');
    expect(html).toContain('Published version 2');
    expect(html).toContain('Unpublished changes');
    expect(html).not.toContain('Draft name');
  });

  it('shows no note when the draft matches the published version', () => {
    const html = renderToStaticMarkup(
      <FormsTable forms={[unchanged]} sessions={[]} canEdit={false} canSubmit={false} />,
    );
    expect(html).toContain('Published name');
    expect(html).not.toContain('Unpublished changes');
  });

  it('shows the draft for a form never published, with no note', () => {
    const html = renderToStaticMarkup(
      <FormsTable forms={[neverPublished]} sessions={[]} canEdit={false} canSubmit={false} />,
    );
    expect(html).toContain('Draft name');
    expect(html).not.toContain('Unpublished changes');
  });
});

describe('the View pop-up shows the published values', () => {
  it('labels the version and shows its name, sessions and questions, not the draft', () => {
    const html = renderToStaticMarkup(
      <FormViewDialog
        form={drafted}
        canEdit={false}
        canSubmit={false}
        onEdit={() => undefined}
        onClose={() => undefined}
      />,
    );
    expect(html).toContain('Published version 2');
    expect(html).toContain('Published name');
    expect(html).toContain('Photo consent');
    expect(html).toContain('Summer camp');
    expect(html).not.toContain('Autumn camp');
    expect(html).not.toContain('Allergies');
    expect(html).not.toContain('Draft name');
  });

  it('says a form never published has no published version yet', () => {
    const html = renderToStaticMarkup(
      <FormViewDialog
        form={neverPublished}
        canEdit={false}
        canSubmit={false}
        onEdit={() => undefined}
        onClose={() => undefined}
      />,
    );
    expect(html).toContain('Not published yet');
    expect(html).not.toContain('Published version');
  });
});

describe('the edit pop-up loads the draft values', () => {
  it('fills the name, season, sessions and questions from the draft, not the published version', () => {
    const html = renderToStaticMarkup(
      <RegistrationFormDialog mode="edit" form={drafted} sessions={[SUMMER, AUTUMN]} onClose={() => undefined} />,
    );
    expect(html).toContain('value="Draft name"');
    expect(html).toContain('value="Summer 2028"');
    expect(html).toContain('Allergies');
    expect(html).not.toContain('value="Published name"');
    expect(html).not.toContain('Photo consent');
  });
});
