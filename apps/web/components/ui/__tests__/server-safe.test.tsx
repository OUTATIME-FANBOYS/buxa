import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, describe, expect, it } from 'vitest';

// The root vitest config compiles JSX with the classic runtime (needs `React` in scope); Next uses the automatic one.
// Provide it here rather than editing the shared config, then load the components.
type Ui = typeof import('@/components/ui');
let ui: Ui;
beforeAll(async () => {
  Object.assign(globalThis, { React });
  ui = await import('@/components/ui');
});

// The server-safe components render to the exact markup the stylesheet expects.
describe('server-safe components', () => {
  it('Pill keeps its dot and classes', () => {
    const { Pill } = ui;
    expect(renderToStaticMarkup(<Pill tone="ok">Done</Pill>)).toBe('<span class="pill pill-ok"><i class="pill-dot" aria-hidden="true"></i>Done</span>');
    expect(renderToStaticMarkup(<Pill dot={false}>x</Pill>)).toBe('<span class="pill pill-neutral">x</span>');
  });
  it('Avatar renders person, agent and unassigned', () => {
    const { Avatar } = ui;
    expect(renderToStaticMarkup(<Avatar user={{ name: 'Maya Chen' }} />)).toContain('>MC</span>');
    expect(renderToStaticMarkup(<Avatar user={{ name: 'Bot', agent: true }} />)).toContain('avatar avatar-agent');
    expect(renderToStaticMarkup(<Avatar />)).toContain('avatar-empty');
  });
  it('Empty, Field, Progress, Icon render', () => {
    const { Empty, Field, Progress, Icon } = ui;
    expect(renderToStaticMarkup(<Empty title="Nothing" body="b" />)).toContain('<strong>Nothing</strong><p>b</p>');
    expect(renderToStaticMarkup(<Field label="Name" error="Bad"><input /></Field>)).toContain('<span class="field-error" role="alert">Bad</span>');
    expect(renderToStaticMarkup(<Progress value={250} />)).toContain('aria-valuenow="100"');
    expect(renderToStaticMarkup(<Icon name="check" size={20} />)).toContain('width="20"');
  });
});
