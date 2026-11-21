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
  /** Centres the footer's buttons (Cancel and the submit) under the form, rather than pushing them to the right. */
  centred?: boolean;
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
  centred = false,
  children,
}: FormPopUpProps) {
  const buttons = (
    <>
      <Button variant="glass" type="button" disabled={pending} onClick={onCancel}>
        Cancel
      </Button>
      <Button type="submit" form={formId} variant="primary" icon={submitIcon} disabled={pending || submitDisabled}>
        {pending && pendingLabel ? pendingLabel : submitLabel}
      </Button>
    </>
  );

  return (
    <Dialog
      title={title}
      onClose={onCancel}
      className={className}
      footer={
        centred ? (
          <div className="buxa:flex buxa:w-full buxa:flex-wrap buxa:items-center buxa:justify-center buxa:gap-2">
            {leading}
            {buttons}
          </div>
        ) : (
          <>
            {leading}
            <span className="buxa:flex-1" />
            {buttons}
          </>
        )
      }
    >
      {intro ? <p className="muted">{intro}</p> : null}
      {children}
    </Dialog>
  );
}
