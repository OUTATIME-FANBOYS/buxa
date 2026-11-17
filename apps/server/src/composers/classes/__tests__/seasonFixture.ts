import { readFileSync } from 'node:fs';

/** The real season file used by the classes import tests (server composer and the web import view). */
export const SEASON_CSV = readFileSync(new URL('./fixtures/season.csv', import.meta.url), 'utf8');
