'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Person } from '@buxa/contracts';
import { FormPopUp } from '@/components/components';
import { Button } from '@/components/elements';
import { loadPersonAction } from '@/actions/people';
import { useUi } from '@buxa/middleware/providers/UiProvider';
import { PersonForm } from './PersonForm';

/** The pop-up's person: fetched when it opens, since the list row carries only a summary. */
type Loaded = { status: 'idle' } | { status: 'loading' } | { status: 'ready'; person: Person } | { status: 'missing' };

/**
 * The row's Edit button on the People list. It opens the same Edit person pop-up as the form's page-level route would show, but in the
 * list, so the list stays in view. The person is loaded when it opens. Cancel, Escape or the close button dismiss it without saving.
 */
export function EditPersonButton({ personId }: { personId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [loaded, setLoaded] = useState<Loaded>({ status: 'idle' });
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
      <Button variant="glass" size="sm" type="button" aria-haspopup="dialog" onClick={openPopUp}>
        Edit
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
          centred
        >
          {loaded.status === 'ready' && (
            <PersonForm
              mode="edit"
              variant="dialog"
              formId={formId}
              person={loaded.person}
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
