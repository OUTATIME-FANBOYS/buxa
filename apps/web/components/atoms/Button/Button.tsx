'use client';

import Link from 'next/link';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, MouseEvent, ReactNode, Ref } from 'react';
import { Icon } from '../Icon';
import { buttonClassName, type ButtonSize, type ButtonVariant } from './buttonClass';

export { buttonClassName };
export type { ButtonSize, ButtonVariant };

/*
 * The one button for the app. Every button is a pill, and each variant's colours come from the Buxa tokens:
 *
 *   primary      filled with the accent: the main action on a screen or in a form
 *   secondary    filled surface with an edge: the default (Cancel, Export, Import)
 *   tertiary     a quieter filled surface, secondary text
 *   outline      border only, on whatever surface it sits on
 *   ghost        text only: navigation-like actions, Clear
 *   danger       filled with the destructive red: confirm a delete or a revoke
 *   danger-soft  tinted red with red text: Revoke, Disconnect, Reset demo data
 *   glass        liquid glass, neutral: the pills' recipe (translucent tint, backdrop blur). Archive camp, Unarchive camp
 *   glass-danger liquid glass, red-tinted: a destructive action such as Delete camp
 *
 * `icon` puts a lucide icon (by name, see icons.tsx) before the label. `iconOnly` makes a round button of just the
 * icon; it needs an aria-label, because the icon alone has no name. Use it where a label would repeat the context
 * (search, close, more). Keep a visible label where the action is not obvious.
 *
 * Sizes: md (44px, the default, the height of inputs), sm (30px, dense rows and panels), lg (52px, check-in actions),
 * and header (36px for page-header actions). On a coarse pointer compact sizes use a 44px touch target.
 *
 * With `href` it renders a link (next/link, or a plain <a> when it downloads), styled the same way.
 * Native button handling covers mouse, touch and keyboard activation.
 * `type` defaults to "submit", as a native button does, so a button inside a form keeps submitting it.
 */

/** Icon size inside a button: the label's cap height, smaller on the dense size. */
const ICON_SIZE: Record<ButtonSize, number> = { sm: 14, md: 16, lg: 16, header: 16 };

type NativeButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'className' | 'children' | 'onClick' | 'disabled' | 'type' | 'value'
>;

interface CommonButtonProps extends NativeButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stretches to the width of its container (the sign-in and form submit buttons). */
  fullWidth?: boolean;
  /** Extra classes for a layout that only one screen needs. */
  className?: string;
  /** Runs on press. It takes no event: use a closure for anything the handler needs. */
  onClick?: () => void;
  /** Runs on press with the click event, for a handler that must stop propagation (a menu trigger inside a card). */
  onPress?: (event: MouseEvent<HTMLButtonElement>) => void;
  /** Disables the button and its hover and press states, as the native attribute does. */
  disabled?: boolean;
  /** Defaults to "submit", as a native button does, so a button in a form submits it. */
  type?: 'button' | 'submit' | 'reset';
  /** The submitted value, for a button that names the action (intent). */
  value?: string;
  /** Makes the button a link. A path inside the app uses next/link; a `download` link renders a plain anchor. */
  href?: string;
  download?: string | boolean;
  target?: string;
  rel?: string;
  ref?: Ref<HTMLElement>;
  /** A widget role the button plays (menuitem, radio, tab). */
  role?: 'menuitem' | 'menuitemradio' | 'radio' | 'tab';
  'aria-checked'?: boolean;
  'aria-selected'?: boolean;
}

/** A label-led button takes its text as children and may lead with an icon. */
interface LabelledProps {
  /** A lucide icon name (icons.tsx) shown before the label. */
  icon?: string;
  iconOnly?: false;
  children?: ReactNode;
  'aria-label'?: string;
}

/** A round, icon-only button. Its content is the icon (or a trigger, or an overlay such as a badge), so the accessible name is required. */
interface IconOnlyProps {
  icon?: string;
  iconOnly: true;
  children?: ReactNode;
  'aria-label': string;
}

export type ButtonProps = CommonButtonProps & (LabelledProps | IconOnlyProps);

export function Button({
  variant = 'secondary',
  size = 'md',
  fullWidth = false,
  className,
  icon,
  iconOnly = false,
  children,
  onClick,
  onPress,
  disabled,
  type,
  href,
  download,
  target,
  rel,
  ref,
  role,
  'aria-checked': ariaChecked,
  'aria-selected': ariaSelected,
  ...rest
}: ButtonProps) {
  const widgetAttrs = { role, 'aria-checked': ariaChecked, 'aria-selected': ariaSelected };
  const extra = className ? [className] : [];
  const content = (
    <>
      {icon !== undefined && <Icon name={icon} size={ICON_SIZE[size]} />}
      {children}
    </>
  );

  if (href !== undefined) {
    const classes = [buttonClassName({ variant, size, fullWidth, iconOnly }), ...extra].join(' ');
    const linkProps = {
      ...(rest as AnchorHTMLAttributes<HTMLAnchorElement>),
      target,
      rel,
      onClick: onClick ? () => onClick() : undefined,
    };

    if (download !== undefined) {
      return (
        <a {...linkProps} ref={ref as Ref<HTMLAnchorElement>} href={href} download={download} className={classes}>
          {content}
        </a>
      );
    }

    return (
      <Link {...linkProps} ref={ref as Ref<HTMLAnchorElement>} href={href} className={classes}>
        {content}
      </Link>
    );
  }

  const classes = [buttonClassName({ variant, size, fullWidth, iconOnly }), ...extra].join(' ');

  return (
    <button
      {...rest}
      {...widgetAttrs}
      ref={ref as Ref<HTMLButtonElement>}
      type={type ?? 'submit'}
      disabled={disabled}
      className={classes}
      onClick={event => (onPress ? onPress(event) : onClick?.())}
    >
      {content}
    </button>
  );
}
