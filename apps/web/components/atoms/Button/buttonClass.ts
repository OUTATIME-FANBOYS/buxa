/* The class string for a button. Plain module, no 'use client', so server components can call it. */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-soft' | 'glass' | 'glass-danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'header';

/** The class string for a button, from styles/components/button.css. */
export function buttonClassName({
  variant = 'secondary',
  size = 'md',
  fullWidth = false,
  iconOnly = false,
}: { variant?: ButtonVariant; size?: ButtonSize; fullWidth?: boolean; iconOnly?: boolean } = {}): string {
  return [
    'button',
    `button--${variant}`,
    size === 'sm' && 'button--sm',
    iconOnly && 'button--icon-only',
    fullWidth && 'button--full-width',
    size === 'lg' && 'button--lg',
    size === 'header' && 'button--header',
  ]
    .filter(Boolean)
    .join(' ');
}
