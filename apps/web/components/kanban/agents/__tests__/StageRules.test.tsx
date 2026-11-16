import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildSeed } from '@/logic/common';
import { type Agent } from '@/logic/common';
import { StageRules } from '../StageRules';

const h = vi.hoisted(() => ({ store: {} as Record<string, unknown> }));
vi.mock('@/components/kanban/state/store', () => ({ useStore: () => h.store }));

const seed = buildSeed();
const agent = { ...seed.agents[0], scope: [seed.projects[0].id], moveRules: { [seed.projects[0].columns[0].id]: 'approve' } } as unknown as Agent;

describe('StageRules', () => {
  beforeEach(() => { h.store = { actions: {}, projects: seed.projects }; });

  it('lists each stage of the agent’s project with its rule, editable for managers', () => {
    const html = renderToStaticMarkup(<StageRules agent={agent} canManage />);
    expect(html).toContain(`aria-label="Moving into ${seed.projects[0].columns[0].name}"`);
    expect(html).toContain('>Ask me</option>');
    expect(html).toContain('>Default</option>');
  });
  it('shows the rule in words, read-only, for others', () => {
    const html = renderToStaticMarkup(<StageRules agent={agent} canManage={false} />);
    expect(html).toContain('pill-warn');
    expect(html).toContain('Ask me');
    expect(html).not.toContain('<select');
  });
  it('shows nothing for an agent with no projects it may touch', () => {
    expect(renderToStaticMarkup(<StageRules agent={{ ...agent, scope: [] } as never} canManage />)).toBe('');
  });
});
