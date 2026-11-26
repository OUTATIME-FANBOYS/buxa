import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Project } from '@buxa/shared';
import { ProjectSwitcher } from '@/components/components/kanban';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push() {}, refresh() {} }) }));

const project = (id: string, name: string) => ({ id, name }) as unknown as Project;

describe('ProjectSwitcher', () => {
  const current = project('p-1', 'Staff Hiring & Training');

  it('renders a chevron trigger named "Switch project"', () => {
    const html = renderToStaticMarkup(<ProjectSwitcher projects={[current]} current={current} />);
    expect(html).toMatch(/<button[^>]*aria-label="Switch project"[^>]*class="[^"]*\bproject-switch\b/);
    expect(html).toContain('aria-haspopup="menu"');
  });

  it('keeps the list closed until the chevron is opened', () => {
    const html = renderToStaticMarkup(<ProjectSwitcher projects={[current]} current={current} />);
    expect(html).not.toContain('All projects');
    expect(html).not.toContain('Staff Hiring &amp; Training</span>');
  });
});
