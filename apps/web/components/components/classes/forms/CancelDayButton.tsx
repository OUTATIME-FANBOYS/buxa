'use client';

import { useActionState, useCallback, useEffect, useState } from 'react';
import { Dialog } from '@/components/components/Dialog';
import { Button } from '@/components/elements';
import { cancelOccurrenceAction, restoreOccurrenceAction } from '@/actions/classes';
import { fieldError, idle } from '@buxa/shared';
import { useUi } from '@buxa/middleware/providers/UiProvider';
import { TextField } from '@/components/atoms';
import { ActionMessage } from './ActionMessage';

/**
 * Cancels one day of a series. A reason is required; it is shown on the day and kept in the audit log. The series and its other days
 * are not changed, and the day takes no place on the calendar, in check-in, in My classes or on the public list.
 */
export function CancelDayButton({
  occurrenceId,
  sessionId,
  dayLabel,
}: {
  occurrenceId: string;
  sessionId: string;
  dayLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const [state, formAction, pending] = useActionState(cancelOccurrenceAction, idle);
  const { toast } = useUi();
  useEffect(() => {
    if (state.status === 'success') {
      toast(state.message ?? 'Day cancelled.');
      setOpen(false);
    }
  }, [state, toast]);

  return (
    <>
      <Button type="button" variant="glass-danger" size="sm" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        Cancel day
      </Button>
      {open && (
        <Dialog title={`Cancel ${dayLabel}?`} onClose={close} className="class-dialog">
          <form action={formAction} className="class-form">
            <input type="hidden" name="occurrenceId" value={occurrenceId} />
            <input type="hidden" name="sessionId" value={sessionId} />
            <p className="class-helper">
              The rest of the class goes on as planned. Enrolled campers keep their place in the class.
            </p>
            <TextField
              label="Reason"
              isRequired
              name="reason"
              maxLength={500}
              autoComplete="off"
              autoFocus
              error={fieldError(state, 'reason')}
            />
            <ActionMessage state={state} />
            <div className="classes-actions">
              <Button variant="glass" type="button" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" variant="glass-danger" disabled={pending}>
                {pending ? 'Cancelling...' : 'Cancel day'}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}

/** Puts a cancelled day back on. The day keeps its own time; its reason is cleared. */
export function RestoreDayButton({
  occurrenceId,
  sessionId,
  dayLabel,
}: {
  occurrenceId: string;
  sessionId: string;
  dayLabel: string;
}) {
  const [state, formAction, pending] = useActionState(restoreOccurrenceAction, idle);
  const { toast } = useUi();
  useEffect(() => {
    if (state.status === 'success') {
      toast(state.message ?? 'Day restored.');
    }
  }, [state, toast]);

  return (
    <form action={formAction}>
      <input type="hidden" name="occurrenceId" value={occurrenceId} />
      <input type="hidden" name="sessionId" value={sessionId} />
      <Button type="submit" variant="glass" size="sm" icon="undo" disabled={pending} aria-label={`Restore ${dayLabel}`}>
        {pending ? 'Restoring...' : 'Restore'}
      </Button>
      {state.status === 'error' && <span className="field-error">{state.message}</span>}
    </form>
  );
}
