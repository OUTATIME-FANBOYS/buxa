'use client';

import { useCallback, useEffect, useState, type ComponentProps } from 'react';
import type { Person } from '@buxa/contracts';
import type { HouseholdChoice } from '@buxa/shared';
import { FormPopUp } from '@/components/components';
import { Button } from '@/components/elements';
import { loadPersonAction } from '@/actions/people';
import { useUi } from '@buxa/middleware/providers/UiProvider';
import { PersonForm } from './PersonForm';

/** The pop-up's person: fetched when it opens, since the list row carries only a summary. */
type Loaded = { status: 'idle' } | { status: 'loading' } | { status: 'ready'; person: Person } | { status: 'missing' };

/**
 * The Edit button for a person: on a People row, and on the person's page (labelled Edit details). It opens the Edit person pop-up in
 * place, so the list or the page stays in view, and the person is loaded when it opens. Cancel, Escape or the close button dismiss it
 * without saving. A save toasts and closes; the page's own revalidation refreshes its details. `initiallyOpen` opens it on first
 * render (the person page's /edit address).
 */
export function EditPersonButton({
  personId,
  households = [],
  label = 'Edit',
  variant = 'glass',
  initiallyOpen = false,
}: {
  personId: string;
  /** The camp's households, for the Household section's select. */
  households?: readonly HouseholdChoice[];
  label?: string;
  /** The button's look. The rows use the neutral glass; the person page's main action is primary. */
  variant?: ComponentProps<typeof Button>['variant'];
  initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [loaded, setLoaded] = useState<Loaded>({ status: 'idle' });
  // The pop-up portals into the page, so it opens after mount, never during server rendering.
  useEffect(() => {
    if (initiallyOpen) {
      setLoaded({ status: 'loading' });
      setOpen(true);
    }
  }, [initiallyOpen]);
  const { toast } = useUi();
  const formId = `edit-person-form-${personId}`;

  useEffect(() => {
    if (!open) {
      return;
    }
    let current = true;
    loadPersonAction(personId).then(
      person => {
        if (current) {
          setLoaded(person ? { status: 'ready', person } : { status: 'missing' });
        }
      },
      () => {
        if (current) {
          setLoaded({ status: 'missing' });
        }
      },
    );

    return () => {
      current = false;
    };
  }, [open, personId]);

  const close = useCallback(() => setOpen(false), []);
  const saved = useCallback(
    (message: string) => {
      toast(message);
      setOpen(false);
    },
    [toast],
  );
  const openPopUp = () => {
    setLoaded({ status: 'loading' });
    setOpen(true);
  };

  return (
    <>
      <Button variant={variant} type="button" aria-haspopup="dialog" onClick={openPopUp}>
        {label}
      </Button>
      {open && (
        <FormPopUp
          title="Edit person"
          formId={formId}
          submitLabel="Save changes"
          pendingLabel="Saving…"
          submitIcon="save"
          pending={pending}
          submitDisabled={loaded.status !== 'ready'}
          onCancel={close}
          className="person-dialog"
        >
          {loaded.status === 'ready' && (
            <PersonForm
              mode="edit"
              variant="dialog"
              formId={formId}
              person={loaded.person}
              households={households}
              onPendingChange={setPending}
              onSaved={saved}
            />
          )}
          {loaded.status === 'missing' && (
            <p className="muted">This person could not be opened. Refresh the list and try again.</p>
          )}
          {(loaded.status === 'idle' || loaded.status === 'loading') && <p className="muted">Loading…</p>}
        </FormPopUp>
      )}
    </>
  );
}
