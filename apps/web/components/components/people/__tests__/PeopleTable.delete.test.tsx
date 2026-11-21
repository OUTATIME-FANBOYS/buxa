// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { PersonSummary } from '@buxa/contracts';
import { UiProvider } from '@buxa/middleware/providers/UiProvider';
import { Dialog as ConfirmDialog } from '@/components/components';
import { PeopleTable } from '@/components/components/people';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ANA = {
  id: '11111111-1111-4111-8111-111111111111',
  givenName: 'Ana',
  familyName: 'Lee',
  preferredName: null,
  roles: ['participant'],
  status: 'active',
  onSite: false,
} as unknown as PersonSummary;

/** Renders the table into the page and returns the host, so the test can ask what the person may see. */
function renderTable(props: { canEdit: boolean; canDelete: boolean }) {
  const host = document.body.appendChild(document.createElement('div'));
  const root = createRoot(host);
  act(() => {
    root.render(
      <UiProvider Dialog={ConfirmDialog}>
        <PeopleTable people={[ANA]} staffView canEdit={props.canEdit} canDelete={props.canDelete} />
      </UiProvider>,
    );
  });

  return {
    host,
    cleanup: () => {
      act(() => root.unmount());
      host.remove();
    },
  };
}

describe('PeopleTable: Edit and Delete by role', () => {
  it('shows Edit to someone who can update people (staff), and no Delete (only the owner deletes)', () => {
    const { host, cleanup } = renderTable({ canEdit: true, canDelete: false });

    expect(host.textContent).toContain('Edit');
    expect(host.querySelector('input[type="checkbox"]')).toBeNull();
    expect(host.querySelector('[aria-label="Delete Ana Lee"]')).toBeNull();
    expect(host.textContent).not.toContain('Delete selected');
    cleanup();
  });

  it('hides Edit and Delete from anyone who can do neither', () => {
    const { host, cleanup } = renderTable({ canEdit: false, canDelete: false });

    expect(host.textContent).not.toContain('Edit');
    expect(host.querySelector('[aria-label="Delete Ana Lee"]')).toBeNull();
    cleanup();
  });

  it('shows the per-row Delete and the checkbox to the owner', () => {
    const { host, cleanup } = renderTable({ canEdit: true, canDelete: true });

    expect(host.querySelector('[aria-label="Delete Ana Lee"]')).not.toBeNull();
    expect(host.querySelector('input[type="checkbox"]')).not.toBeNull();
    cleanup();
  });
});
