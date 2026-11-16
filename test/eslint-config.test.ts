import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Guards the lint setup: the config must exist and must keep the no-explicit-any rule.
const configPath = fileURLToPath(new URL('../eslint.config.mjs', import.meta.url));

describe('eslint.config.mjs', () => {
  it('exists and keeps the @typescript-eslint/no-explicit-any rule', () => {
    expect(existsSync(configPath)).toBe(true);
    expect(readFileSync(configPath, 'utf8')).toContain('@typescript-eslint/no-explicit-any');
  });
});
