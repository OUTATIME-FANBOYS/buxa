import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** The phone block of each stylesheet: everything inside the first `@media (max-width: 720px)` after the given marker. */
// Prettier breaks rules over several lines, so the stylesheet text is flattened to one line before matching.
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\s+/g, ' ');
const attendance = read('./features/attendance.css');
const phoneBlock = attendance.slice(
  attendance.indexOf('@media (max-width: 720px)'),
  attendance.indexOf('.log-filters'),
);
const tsx = (path: string) => read(`../components/components/${path}`);

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
    expect(tsx('attendance/ScanPanel.tsx')).toContain('btn-camera');
  });

  it('the scan field and the names are at least 16px, so iOS does not zoom', () => {
    expect(phoneBlock).toMatch(/\.scan-panel input \{ font-size: 16px; \}/);
  });

  it('on site cards keep the name and the compact check-out button in one row, and the dialog buttons share a row', () => {
    expect(phoneBlock).not.toContain('.onsite-head { flex-direction: column; align-items: stretch; }');
    expect(phoneBlock).toContain('.checkout-actions .button { flex: 1 1 0; }');
    expect(tsx('attendance/OnSiteRow.tsx')).toContain('onsite-btn');
    expect(tsx('attendance/CheckOutPanel.tsx')).toContain('className="checkout-actions"');
  });

  it('the log stacks each visit, with a label in front of each value', () => {
    expect(phoneBlock).toContain('.log-table thead { display: none; }');
    expect(phoneBlock).toContain('content: attr(data-label);');
    const log = tsx('attendance/LogTable.tsx');
    for (const label of ['In', 'Out', 'Checked in by', 'Checked out by', 'Collected by', 'Method', 'Override reason']) {
      expect(log).toContain(`data-label="${label}"`);
    }
  });

  it('the result comes right after the scan field on a phone, with the name search last', () => {
    expect(attendance).toContain("grid-template-areas: 'input' 'result' 'find';");
    expect(tsx('attendance/CheckInConsole.tsx')).toContain('className="checkin-find"');
  });

  it('all touch controls use the 44px control height token, not a literal', () => {
    expect(attendance).toMatch(/\.att-btn-lg, \.name-result, \.choice \{ min-height: 44px; \}/);
    expect(read('./tokens.css')).toContain('--control-h: 44px');
  });
});

// Added with the Add person dialog: the form keeps 44px controls and 16px inputs on a touch screen, and its own compact height elsewhere.
describe('Add person form on a touch screen', () => {
  const people = read('./features/people.css');
  it('uses the touch target height and 16px inputs on a coarse pointer', () => {
    expect(people).toContain('@media (pointer: coarse) { /* Touch');
    expect(people).toContain('form.person-form { --control-h: var(--control-touch); }');
    expect(people).toMatch(
      /\.person-form input:not\(\[type='checkbox'\]\), \.person-form select \{ font-size: 16px; \}/,
    );
    expect(read('./tokens.css')).toContain('--control-touch: 44px');
  });
});

describe('settings grid', () => {
  it('is one full-width column at every width, with no fixed page width', () => {
    const settings = read('./features/settings.css');
    expect(settings).toContain('.settings-grid { display: grid; grid-template-columns: minmax(0, 1fr);');
    expect(settings).not.toMatch(/\.settings-grid\s*{[^}]*repeat\(2/);
    expect(settings).not.toContain('min-width: 1280px');
    expect(settings).toContain('.page.settings-page { max-width: none; }');
  });

  it('keeps the segmented controls (theme, clock) inside their card at every width', () => {
    const settings = read('./features/settings.css');
    expect(settings).toContain(
      '.settings-page .segmented { display: flex; width: 100%; max-width: 100%; min-width: 0; box-sizing: border-box; }',
    );
    expect(settings).toContain('.settings-page .segmented button { flex: 1 1 0; min-width: 0;');
    expect(settings).toContain('overflow-wrap: anywhere;');
  });
});
