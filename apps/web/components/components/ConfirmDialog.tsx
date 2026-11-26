'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Dialog } from '@/components/components/Dialog';
import { Button } from '@/components/elements';
import { TextField } from '@/components/atoms';

/**
 * `danger` is the red action with the trash icon, used for every delete. `neutral` is a primary action (Archive, Continue).
 */
export type ConfirmVariant = 'danger' | 'neutral';

/** The body sits on the left, one block per line. Pinned here so no delete prompt lays out its own text. */
const BODY = 'buxa:grid buxa:gap-3 buxa:text-left';

export interface ConfirmDialogProps {
  title: string;
  /** Left aligned. Any content: a sentence, a name in bold, a list, an error line, hidden form fields. */
  body?: ReactNode;
  /** Defaults to `danger`. */
  variant?: ConfirmVariant;
  /** The action's label, for example "Delete" or "Archive camp". */
  confirmLabel: string;
  /** The action's label while `pending`, for example "Deleting...". Defaults to the confirm label. */
  pendingLabel?: string;
  /** Defaults to "Cancel". A back step can use "Back". */
  cancelLabel?: string;
  /** Runs on Cancel, on the close button and on Escape. */
  onCancel: () => void;
  /** Runs when the action is pressed. Use this, or `formId` (not both). */
  onConfirm?: () => void;
  /**
   * The id of the form the action submits. ConfirmDialog renders the body inside that form, with `formAction` as its action,
   * so the body holds the form's hidden fields and the action is a submit button.
   */
  formId?: string;
  formAction?: (formData: FormData) => void;
  /** Disables both buttons while a request runs. */
  pending?: boolean;
  /** Keeps only the action disabled, for example until the body has checked what it will delete. */
  confirmDisabled?: boolean;
  /**
   * When set, the action stays disabled until the user types this text exactly. The text field is named `confirmName`, as the
   * server reads it.
   */
  confirmText?: string;
  /** An extra action between Cancel and the confirm action (for example Archive beside Delete). It is a neutral button. */
  secondaryAction?: ReactNode;
  className?: string;
}

/**
 * The one confirmation prompt for the app. It sits on Dialog, so the title and close button are Dialog's. The body is left
 * aligned, and the footer is right aligned: Cancel first, then the action, the same on every prompt.
 */
export function ConfirmDialog({
  title,
  body,
  variant = 'danger',
  confirmLabel,
  pendingLabel,
  cancelLabel = 'Cancel',
  onCancel,
  onConfirm,
  formId,
  formAction,
  pending = false,
  confirmDisabled = false,
  confirmText,
  secondaryAction,
  className = '',
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('');
  // Going back to a step without the typed name clears what was typed, so the next time it starts empty.
  useEffect(() => {
    if (confirmText === undefined) {
      setTyped('');
    }
  }, [confirmText]);
  const nameMatches = confirmText === undefined || typed === confirmText;
  const disabled = pending || confirmDisabled || !nameMatches;
  const label = pending ? (pendingLabel ?? confirmLabel) : confirmLabel;

  const confirmButton =
    variant === 'danger' ? (
      <Button
        variant="glass-danger"
        type={formId ? 'submit' : 'button'}
        form={formId}
        icon="trash"
        disabled={disabled}
        onClick={formId ? undefined : onConfirm}
      >
        {label}
      </Button>
    ) : (
      <Button
        variant="primary"
        type={formId ? 'submit' : 'button'}
        form={formId}
        disabled={disabled}
        onClick={formId ? undefined : onConfirm}
      >
        {label}
      </Button>
    );

  const content = (
    <>
      {body}
      {confirmText !== undefined && (
        <TextField
          label={`Type ${confirmText} to confirm`}
          name="confirmName"
          value={typed}
          onChange={setTyped}
          autoComplete="off"
          spellCheck={false}
          autoFocus
        />
      )}
    </>
  );

  return (
    <Dialog
      title={title}
      onClose={onCancel}
      className={className}
      footer={
        <>
          <Button variant="glass" type="button" disabled={pending} onClick={onCancel}>
            {cancelLabel}
          </Button>
          {secondaryAction}
          {confirmButton}
        </>
      }
    >
      {formId ? (
        <form id={formId} action={formAction} className={BODY} data-testid="confirm-body">
          {content}
        </form>
      ) : (
        <div className={BODY} data-testid="confirm-body">
          {content}
        </div>
      )}
    </Dialog>
  );
}
