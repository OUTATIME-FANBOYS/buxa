'use client';

import { Button as HeroButton } from '@heroui/react/button';
import { buttonVariants } from '@heroui/styles';
import Link from 'next/link';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ComponentProps, ReactNode, Ref } from 'react';
import { Icon } from './Icon';

/*
 * The one button for the app. Call sites write <Button variant="primary">; they do not import HeroUI.
 * Every button is a pill. The variants are HeroUI's names, and each one's colours come from the Buxa tokens:
 *
 *   primary      filled with the accent: the main action on a screen or in a form
 *   secondary    filled surface with an edge: the default (Cancel, Export, Import)
 *   tertiary     a quieter filled surface, secondary text
 *   outline      border only, on whatever surface it sits on
 *   ghost        text only: navigation-like actions, Clear
 *   danger       filled with the destructive red: confirm a delete or a revoke
 *   danger-soft  tinted red with red text: Revoke, Disconnect, Reset demo data
 *
 * `icon` puts a lucide icon (by name, see icons.tsx) before the label. `iconOnly` makes a round button of just the
 * icon; it needs an aria-label, because the icon alone has no name. Use it where a label would repeat the context
 * (search, close, more). Keep a visible label where the action is not obvious.
 *
 * Sizes: md (44px, the default, the height of inputs), sm (30px, dense rows and panels), header (36px on a mouse
 * or keyboard device, for page-header actions). On a coarse pointer every size is 44px (styles/components/button.css).
 *
 * With `href` it renders a link (next/link, or a plain <a> when it downloads), styled the same way.
 * With `onClick` it runs on press (HeroUI's press handling covers mouse, touch and keyboard).
 * `type` defaults to "submit", as a native button does, so a button inside a form keeps submitting it.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'outline' | 'ghost' | 'danger' | 'danger-soft';
export type ButtonSize = 'sm' | 'md' | 'header';

/** Icon size inside a button: the label's cap height, smaller on the dense size. */
const ICON_SIZE: Record<ButtonSize, number> = { sm: 14, md: 16, header: 16 };

/** Buxa size to the HeroUI size class. The heights themselves are in styles/components/button.css. */
const HEROUI_SIZE = { sm: 'sm', md: 'md', header: 'md' } as const;

/** The Buxa-only classes for a size and icon form (the HeroUI classes come from buttonVariants). */
function buxaClasses(size: ButtonSize): string[] {
  return [size === 'header' && 'buxa-button--header'].filter((c): c is string => typeof c === 'string');
}

/**
 * The class string for a button, for markup that cannot be a Button: a <summary> that toggles a disclosure.
 * Prefer <Button>; this exists only where the element itself is fixed by the markup.
 */
export function buttonClassName({
  variant = 'secondary',
  size = 'md',
  fullWidth = false,
  iconOnly = false,
}: { variant?: ButtonVariant; size?: ButtonSize; fullWidth?: boolean; iconOnly?: boolean } = {}): string {
  const heroui = buttonVariants({ variant, size: HEROUI_SIZE[size], isIconOnly: iconOnly, fullWidth });

  return [heroui, ...buxaClasses(size)].join(' ');
}

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
  ...rest
}: ButtonProps) {
  const extra = className ? [className] : [];
  const press = onPress ?? (onClick ? () => onClick() : undefined);
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

  const classes = [...buxaClasses(size), ...extra].join(' ');

  return (
    <HeroButton
      {...(rest as ComponentProps<typeof HeroButton>)}
      ref={ref as Ref<HTMLButtonElement>}
      type={type ?? 'submit'}
      variant={variant}
      size={HEROUI_SIZE[size]}
      isIconOnly={iconOnly}
      fullWidth={fullWidth}
      isDisabled={disabled}
      className={classes}
      onPress={press}
    >
      {content}
    </HeroButton>
  );
}
