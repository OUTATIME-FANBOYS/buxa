import type { ComponentType } from 'react';
import type { ConfirmDialogProps } from '../UiProvider';

/** A stand-in for the web app's ConfirmDialog: the same role and label, so the confirm prompt can be tested in this package. */
export const StubDialog: ComponentType<ConfirmDialogProps> = ({ title, body, confirmLabel, onCancel, onConfirm }) => (
  <div role="dialog" aria-label={title}>
    {body}
    <button type="button" onClick={onCancel}>
      Cancel
    </button>
    <button type="button" onClick={onConfirm}>
      {confirmLabel}
    </button>
  </div>
);
