/** The five-colour system. A tone always travels with a text label, never colour alone. */
export type Tone = 'neutral' | 'brand' | 'ok' | 'warn' | 'crit' | 'agent' | 'hero';
/** Camp role pills only (see ROLE_TONE in camp/abilities). Not status colours, so they are kept out of `Tone`. */
export type RoleTone = 'role-owner' | 'role-admin' | 'role-staff' | 'role-viewer';

export const KIND_TONE: Record<'open' | 'active' | 'done', Tone> = { open: 'neutral', active: 'brand', done: 'ok' };

/** The five palette hues, in a fixed order, shared by avatars and tags. */
export const PALETTE_HUES = ['brand', 'ok', 'crit', 'agent', 'neutral'] as const;
export type PaletteHue = (typeof PALETTE_HUES)[number];

const hueIndex = (text: string): number => Array.from(text).reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE_HUES.length;

/** A stable hue for a name, so the same person always gets the same colour. */
export const avatarHue = (name: string): PaletteHue => PALETTE_HUES[hueIndex(name)];

/** A stable palette hue for a tag, so the same tag always has the same colour. */
export const tagHue = (tag: string): PaletteHue => PALETTE_HUES[hueIndex(tag.trim().toLowerCase())];
