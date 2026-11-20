/*
 * Utility classes for the settings page. The page's own CSS is gone: each card, row and control carries these.
 * Every rule that overrides an unlayered stylesheet rule (.panel, .page, .segmented, base h2 and button) is forced (!),
 * because a utility in the Tailwind layer cannot beat unlayered CSS.
 */

/** The one-column grid of cards: one full-width column at every width, with no fixed page width. */
export const SETTINGS_GRID = 'buxa:grid buxa:grid-cols-[minmax(0,1fr)] buxa:gap-[var(--s5)] buxa:items-stretch';
/** A card whose title and description sit on the left and whose control sits on the right (time format, appearance). */
export const SETTINGS_CHOICE = 'buxa:flex! buxa:items-center buxa:justify-between buxa:gap-[var(--s4)] buxa:flex-wrap';
export const SETTINGS_CHOICE_TEXT = 'buxa:min-w-0 buxa:flex-[1_1_260px]';
/** The control on the right of a choice card: a fixed width, so it never stretches. */
export const SETTINGS_CHOICE_CONTROL = 'buxa:flex-[0_0_260px] buxa:max-w-full';

/** Every card's heading shares one size, so the cards read as one set. */
export const SETTINGS_TILE_HEADING = 'buxa:text-[16px]! buxa:leading-[1.3]';
/** A card's description under its heading. */
export const SETTINGS_TILE_TEXT = 'buxa:text-[14px] buxa:leading-[1.5]';

/** The theme and clock choices in a settings card: the group fills the card's control and never runs past its border, and
 * the options share the width and wrap their labels. */
export const CARD_SEGMENTED =
  'buxa:flex! buxa:w-full buxa:max-w-full buxa:min-w-0 buxa:box-border! buxa:[&_button]:h-auto! buxa:[&_button]:min-h-[30px]! buxa:[&_button]:flex-[1_1_0]! buxa:[&_button]:min-w-0! buxa:[&_button]:px-[var(--s2)]! buxa:[&_button]:py-[4px]! buxa:[&_button]:justify-center! buxa:[&_button]:text-center! buxa:[&_button]:whitespace-normal! buxa:[&_button]:[overflow-wrap:anywhere]! buxa:[&_button]:leading-[1.25]!';
