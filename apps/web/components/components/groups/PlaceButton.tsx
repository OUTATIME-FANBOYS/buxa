'use client';

import { useCallback, useState } from 'react';
import { useUi } from '@buxa/middleware/providers/UiProvider';
import type { ButtonSize, ButtonVariant } from '@/components/atoms';
import { Button } from '@/components/elements';
import { AssignPopUp, type AssignChoices } from './AssignDialog';

export interface PlaceButtonProps {
  /** The people and the groups and rooms the Place or move pop-up offers. */
  choices: AssignChoices;
  /** A camper to preselect (a row's Place button). Omitted when the button opens the pop-up with nobody chosen. */
  personId?: string;
  /** The button's text. */
  label?: string;
  /** A lucide icon name shown before the label. */
  icon?: string;
  /** Defaults to the glass variant, which suits rows. */
  variant?: ButtonVariant;
  /** Defaults to sm. */
  size?: ButtonSize;
  className?: string;
  /** The accessible name, when the label alone does not say which person the button is for. */
  accessibleName?: string;
}

/**
 * The one Place action. It renders the app's Button and owns the Place or move pop-up it opens. A success shows a toast and closes
 * the pop-up. Whoever renders it checks the permission first (`classes:manage`): this component does not check it.
 */
export function PlaceButton({
  choices,
  personId,
  label = 'Place',
  icon,
  variant = 'glass',
  size = 'sm',
  className,
  accessibleName,
}: PlaceButtonProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useUi();
  const close = useCallback(() => setOpen(false), []);
  const done = useCallback(
    (message: string) => {
      toast(message);
      setOpen(false);
    },
    [toast],
  );

  return (
    <>
      <Button
        variant={variant}
        size={size}
        type="button"
        icon={icon}
        className={className}
        aria-label={accessibleName}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      {open && <AssignPopUp choices={choices} presetPersonId={personId} onCancel={close} onDone={done} />}
    </>
  );
}
