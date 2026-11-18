'use client';

import { Button as HeroButton } from '@heroui/react/button';
import { buttonVariants } from '@heroui/styles';
import Link from 'next/link';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ComponentProps, ReactNode, Ref } from 'react';

/*
 * The one button for the app. Call sites write <Button variant="primary">; they do not import HeroUI.
 *
 *   primary      filled with the accent: the main action on a screen or in a form
 *   secondary    outlined on the surface: the default (Cancel, Export, Import)
 *   ghost        text only, quiet: navigation-like actions and Clear
 *   danger       filled with the destructive red: confirm a delete or a revoke
 *   danger-ghost text only, in the destructive red: Revoke, Disconnect, Reset demo data
 *   icon         round, icon only: more, close, settings, delete. Give it an aria-label.
 *
 * Sizes: md (44px, the default, the height of inputs), sm (30px, dense rows and panels), header (36px on a mouse or
 * keyboard device, for page-header actions). On a coarse pointer every size is 44px (styles/components/button.css).
 *
 * With `href` it renders a link (next/link, or a plain <a> when it downloads), styled the same way.
 * With `onClick` it runs on press (HeroUI's press handling covers mouse, touch and keyboard).
 * `type` defaults to "submit", as a native button does, so a button inside a form keeps submitting it.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-ghost' | 'icon';
export type ButtonSize = 'sm' | 'md' | 'header';

/** Buxa variant to the HeroUI variant whose classes and colours it uses. */
const HEROUI_VARIANT = {
  primary: 'primary',
  secondary: 'outline',
  ghost: 'ghost',
  danger: 'danger',
  'danger-ghost': 'ghost',
  icon: 'ghost',
} as const;

/** Buxa size to the HeroUI size class. The heights themselves are in styles/components/button.css. */
const HEROUI_SIZE = { sm: 'sm', md: 'md', header: 'md' } as const;

/** The Buxa-only classes for a variant and size (the HeroUI classes come from buttonVariants). */
function buxaClasses(variant: ButtonVariant, size: ButtonSize): string[] {
  return [
    variant === 'danger-ghost' && 'buxa-button--danger-text',
    variant === 'icon' && 'buxa-button--icon',
    size === 'header' && 'buxa-button--header',
  ].filter((c): c is string => typeof c === 'string');
}

/**
 * The class string for a button, for markup that cannot be a Button: a <summary> that toggles a disclosure.
 * Prefer <Button>; this exists only where the element itself is fixed by the markup.
 */
export function buttonClassName({ variant = 'secondary', size = 'md', fullWidth = false }: { variant?: ButtonVariant; size?: ButtonSize; fullWidth?: boolean } = {}): string {
  const heroui = buttonVariants({ variant: HEROUI_VARIANT[variant], size: HEROUI_SIZE[size], isIconOnly: variant === 'icon', fullWidth });

  return [heroui, ...buxaClasses(variant, size)].join(' ');
}

type NativeButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children' | 'onClick' | 'disabled' | 'type' | 'value'>;

export interface ButtonProps extends NativeButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stretches to the width of its container (the sign-in and form submit buttons). */
  fullWidth?: boolean;
  /** Extra classes for a layout that only one screen needs. */
  className?: string;
  children?: ReactNode;
  /** Runs on press. It takes no event: use a closure for anything the handler needs. */
  onClick?: () => void;
  /** Runs on press with HeroUI's press event, for a handler that must stop propagation (a menu trigger inside a card). */
  onPress?: NonNullable<ComponentProps<typeof HeroButton>['onPress']>;
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
}

export function Button({ variant = 'secondary', size = 'md', fullWidth = false, className, children, onClick, onPress, disabled, type, href, download, target, rel, ref, ...rest }: ButtonProps) {
  const extra = className ? [className] : [];
  const press = onPress ?? (onClick ? () => onClick() : undefined);

  if (href !== undefined) {
    const classes = [buttonClassName({ variant, size, fullWidth }), ...extra].join(' ');
    const linkProps = { ...(rest as AnchorHTMLAttributes<HTMLAnchorElement>), target, rel, onClick: onClick ? () => onClick() : undefined };

    if (download !== undefined) {
      return <a {...linkProps} ref={ref as Ref<HTMLAnchorElement>} href={href} download={download} className={classes}>{children}</a>;
    }

    return <Link {...linkProps} ref={ref as Ref<HTMLAnchorElement>} href={href} className={classes}>{children}</Link>;
  }

  const classes = [...buxaClasses(variant, size), ...extra].join(' ');

  return (
    <HeroButton
      {...(rest as ComponentProps<typeof HeroButton>)}
      ref={ref as Ref<HTMLButtonElement>}
      type={type ?? 'submit'}
      variant={HEROUI_VARIANT[variant]}
      size={HEROUI_SIZE[size]}
      isIconOnly={variant === 'icon'}
      fullWidth={fullWidth}
      isDisabled={disabled}
      className={classes}
      onPress={press}
    >
      {children}
    </HeroButton>
  );
}
