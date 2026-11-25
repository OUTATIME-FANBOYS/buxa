'use client';

import { useCallback, useState } from 'react';
import { FormPopUp } from '@/components/components';
import { Button } from '@/components/elements';
import { useUi } from '@buxa/middleware/providers/UiProvider';
import type { Series } from '@buxa/contracts';
import { ClassForm, type InstructorChoice } from './ClassForm';

/**
 * Opens a series' edit in a dialog. It is the New class form, prefilled from the series (ClassForm with `series`): the same fields,
 * the same intro and the same footer, with Save class in place of Add class. A teacher on the series (detailsOnly) sees the name only.
 */
export function EditSeriesButton({
  series,
  sessionName,
  instructors,
  detailsOnly = false,
}: {
  series: Series;
  sessionName: string;
  instructors: readonly InstructorChoice[];
  detailsOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const { toast } = useUi();
  // A saved form closes the pop-up and toasts the server's message.
  const saved = useCallback(
    (message: string) => {
      toast(message);
      setOpen(false);
    },
    [toast],
  );
  const formId = `edit-series-${series.id}`;

  return (
    <>
      <Button
        type="button"
        variant="glass"
        size="sm"
        iconOnly
        icon="edit"
        aria-label={`Edit ${series.name}`}
        title="Edit class"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      />
      {open && (
        <FormPopUp
          title="Edit class"
          formId={formId}
          submitLabel="Save class"
          pendingLabel="Saving..."
          submitIcon="save"
          pending={pending}
          onCancel={close}
        >
          <ClassForm
            sessionId={series.sessionId}
            sessionName={sessionName}
            instructors={instructors}
            variant="dialog"
            formId={formId}
            series={series}
            detailsOnly={detailsOnly}
            onPendingChange={setPending}
            onSaved={saved}
          />
        </FormPopUp>
      )}
    </>
  );
}
