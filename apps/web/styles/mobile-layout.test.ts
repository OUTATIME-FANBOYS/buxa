import { readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/** The phone block of each stylesheet: everything inside the first `@media (max-width: 720px)` after the given marker. */
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const attendance = read('./features/attendance.css');
const phoneBlock = attendance.slice(attendance.indexOf('@media (max-width: 720px)'), attendance.indexOf('.log-filters'));
// Components move between layers, so a component is found by its file name anywhere under apps/web.
const appRoot = fileURLToPath(new URL('../', import.meta.url));
const findByName = (dir: string, name: string): string | null => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) { const hit = findByName(full, name); if (hit) return hit; }
    else if (entry.name === name) return full;
  }
  return null;
};
const tsx = (path: string) => {
  const name = basename(path);
  const file = findByName(appRoot, name);
  if (!file) throw new Error(`no source file named ${name}`);
  return readFileSync(file, 'utf8');
};

describe('sign-in on a phone', () => {
  it('the single column may shrink below its widest child, so the page does not scroll sideways', () => {
    const responsive = read('./responsive.css');
    expect(responsive).toContain('.auth { grid-template-columns: minmax(0, 1fr);');
    expect(responsive).not.toMatch(/\.auth \{ grid-template-columns: 1fr;/);
  });
});

describe('phone layout for check-in, on site and the log', () => {
  it('the camera button is full width, primary and at least the control height', () => {
    expect(phoneBlock).toContain('.scan-panel .btn-camera { width: 100%; min-height: var(--control-h); }');
    expect(tsx('attendance/checkIn/ScanPanel.tsx')).toContain('btn-camera');
  });

  it('the scan field and the names are at least 16px, so iOS does not zoom', () => {
    expect(phoneBlock).toMatch(/\.scan-panel input \{ font-size: 16px; \}/);
  });

  it('on site rows stack and the check-out button takes the full width', () => {
    expect(phoneBlock).toContain('.onsite-head { flex-direction: column; align-items: stretch; }');
    expect(phoneBlock).toMatch(/\.onsite-head \.btn, \.checkout-panel \.btn \{ width: 100%; \}/);
    expect(tsx('attendance/checkOut/OnSiteRow.tsx')).toContain('att-btn-lg');
  });

  it('the log stacks each visit, with a label in front of each value', () => {
    expect(phoneBlock).toContain('.log-table thead { display: none; }');
    expect(phoneBlock).toContain("content: attr(data-label);");
    const log = tsx('attendance/components/LogTable.tsx');
    for (const label of ['In', 'Out', 'Checked in by', 'Checked out by', 'Collected by', 'Method', 'Override reason']) {
      expect(log).toContain(`data-label="${label}"`);
    }
  });

  it('the result comes right after the scan field on a phone, with the name search last', () => {
    expect(attendance).toContain("grid-template-areas: 'input' 'result' 'find';");
    expect(tsx('attendance/checkIn/CheckInConsole.tsx')).toContain('className="checkin-find"');
  });

  it('all touch controls use the 44px control height token, not a literal', () => {
    expect(attendance).toMatch(/\.att-btn-lg, \.name-result, \.choice \{ min-height: 44px; \}/);
    expect(read('./tokens.css')).toContain('--control-h: 44px');
  });
});
