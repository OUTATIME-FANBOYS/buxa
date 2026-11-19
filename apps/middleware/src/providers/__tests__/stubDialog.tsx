import type { ComponentType } from 'react';
import type { ConfirmDialogProps } from '../UiProvider';

/** A stand-in for the web app's Dialog: the same role and label, so the confirm prompt can be tested in this package. */
export const StubDialog: ComponentType<ConfirmDialogProps> = ({ title, footer, children }) => (
  <div role="dialog" aria-label={title}>
    {children}
    {footer}
  </div>
);
