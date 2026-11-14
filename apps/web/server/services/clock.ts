/** The current instant. Injected so tests control "now" (and the camp's local day) instead of reading the real clock. */
export type Clock = () => Date;
export const systemClock: Clock = () => new Date();
