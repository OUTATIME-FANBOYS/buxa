import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Prettier breaks rules over several lines, so the stylesheet is flattened to one line before matching.
const board = readFileSync(new URL('./features/kanban/board.css', import.meta.url), 'utf8').replace(/\s+/g, ' ');

describe('board card meta line', () => {
  it('stays on one line: no wrapping, and the items keep their size', () => {
    expect(board).toMatch(/\.card-meta \{[^}]*flex-wrap: nowrap;/);
    expect(board).not.toMatch(/\.card-meta \{[^}]*flex-wrap: wrap;/);
    expect(board).toMatch(/\.card-meta > \* \{ flex: none; \}/);
  });
  it('lets only the due date give way when the card is narrow', () => {
    expect(board).toMatch(/\.card-meta \.due \{[^}]*flex: 0 1 auto;/);
  });
});
