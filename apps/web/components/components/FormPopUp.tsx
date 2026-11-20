'use client';

import type { ReactNode } from 'react';
import { Dialog } from '@/components/components/Dialog';
import { Button } from '@/components/elements';

export interface FormPopUpProps {
  title: string;
  /** A line under the title, above the fields. */
  intro?: ReactNode;
  /** The id of the <form> in the body. The submit button sits in the footer and submits that form by its id. */
  formId: string;
  submitLabel: string;
  /** The submit label while the form is saving. Defaults to the submit label. */
  pendingLabel?: string;
  submitIcon?: string;
  pending?: boolean;
  /** Turns the submit button off, for example while a required list is empty. */
  submitDisabled?: boolean;
  onCancel: () => void;
  /** An action on the footer's left, away from Cancel and submit (for example a delete). */
  leading?: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * The one frame for a form dialog. The header (title and close) and the scrolling body come from Dialog; this adds the pinned
 * footer every form dialog shares: Cancel (glass) and the primary action (orange, with its icon). The footer never scrolls. The
 * fields and their validation stay in the form, which is passed as the children.
 */
export function FormPopUp({
  title,
  intro,
  formId,
  submitLabel,
  pendingLabel,
  submitIcon,
  pending = false,
  submitDisabled = false,
  onCancel,
  leading,
  className = 'class-dialog',
  children,
}: FormPopUpProps) {
  return (
    <Dialog
      title={title}
      onClose={onCancel}
      className={className}
      footer={
        <>
          {leading}
          <span className="buxa:flex-1" />
          <Button variant="glass" type="button" disabled={pending} onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary" icon={submitIcon} disabled={pending || submitDisabled}>
            {pending && pendingLabel ? pendingLabel : submitLabel}
          </Button>
        </>
      }
    >
      {intro ? <p className="muted">{intro}</p> : null}
      {children}
    </Dialog>
  );
}
