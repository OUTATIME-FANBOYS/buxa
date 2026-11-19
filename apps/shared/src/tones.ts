/** The tones. A tone always travels with a text label, never colour alone. */
export type Tone = 'neutral' | 'brand' | 'ok' | 'warn' | 'crit' | 'agent' | 'info';
/** Camp role pills only (see ROLE_TONE in camp/abilities). Not status colours, so they are kept out of `Tone`. */
export type RoleTone = 'role-owner' | 'role-admin' | 'role-staff' | 'role-viewer' | 'role-guardian' | 'role-camper';

/**
 * The rainbow hues a pill can take (tokens.css: --hue-<name>). One map, below, says which hue each tone and role takes; change a
 * line there and the pill follows. A test keeps tokens.css in step with these maps.
 */
export type PillHue =
  'pink' | 'red' | 'orange' | 'yellow' | 'lime' | 'green' | 'teal' | 'blue' | 'violet' | 'purple' | 'grey';

/** The hue of each tone: neutral grey, brand yellow, ok green, warn orange, crit red, agent purple, info blue. */
export const TONE_HUE: Readonly<Record<Tone, PillHue>> = {
  neutral: 'grey',
  brand: 'yellow',
  ok: 'green',
  warn: 'orange',
  crit: 'red',
  agent: 'purple',
  info: 'blue',
};

/**
 * The hue of each camp role's pill. The four hues no tone uses (pink, lime, teal, violet) go to four roles, one each. There are
 * six roles and only four spare hues, so viewer takes blue (shared with the info tone) and camper takes purple (shared with agent).
 */
export const ROLE_HUE: Readonly<Record<RoleTone, PillHue>> = {
  'role-owner': 'violet',
  'role-admin': 'teal',
  'role-staff': 'lime',
  'role-viewer': 'blue',
  'role-guardian': 'pink',
  'role-camper': 'purple',
};
/** The colour of each camp role's pill on the people list. Staff-like roles use the team colours (admin orange, staff green); campers are maroon, guardians pink. */
export const CAMP_ROLE_TONE = {
  camper: 'role-camper',
  participant: 'role-camper',
  guardian: 'role-guardian',
  admin_staff: 'role-admin',
  instructor: 'role-staff',
  organizer: 'role-staff',
} as const;

export const KIND_TONE: Record<'open' | 'active' | 'done', Tone> = { open: 'neutral', active: 'brand', done: 'ok' };

/** The five palette hues, in a fixed order, used for avatars. */
export const PALETTE_HUES = ['brand', 'ok', 'crit', 'agent', 'neutral'] as const;
export type PaletteHue = (typeof PALETTE_HUES)[number];

const hueIndex = (text: string): number =>
  Array.from(text).reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE_HUES.length;

/** A stable hue for a name, so the same person always gets the same colour. */
export const avatarHue = (name: string): PaletteHue => PALETTE_HUES[hueIndex(name)];
