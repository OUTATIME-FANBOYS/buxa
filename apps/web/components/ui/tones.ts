/** The five-colour system. A tone always travels with a text label, never colour alone. */
export type Tone = 'neutral' | 'brand' | 'ok' | 'warn' | 'crit' | 'agent';

export const KIND_TONE: Record<'open' | 'active' | 'done', Tone> = { open: 'neutral', active: 'brand', done: 'ok' };

const AVATAR_HUES = ['brand', 'ok', 'warn', 'neutral'] as const;
export type AvatarHue = (typeof AVATAR_HUES)[number];

/** A stable hue for a name, so the same person always gets the same colour. */
export const avatarHue = (name: string): AvatarHue => AVATAR_HUES[Array.from(name).reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_HUES.length];
