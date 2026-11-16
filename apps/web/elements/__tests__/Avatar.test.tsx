import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Avatar } from '../Avatar';

describe('Avatar', () => {
  it('shows initials and the name for a person', () => {
    const html = renderToStaticMarkup(<Avatar user={{ name: 'Maya Chen' }} />);
    expect(html).toContain('>MC</span>');
    expect(html).toContain('aria-label="Maya Chen"');
    expect(html).toMatch(/class="avatar avatar-[a-z0-9-]+"/);
  });
  it('marks an agent with its own class and label', () => {
    const html = renderToStaticMarkup(<Avatar user={{ name: 'Triage', agent: true }} />);
    expect(html).toContain('avatar avatar-agent');
    expect(html).toContain('aria-label="Triage, agent"');
  });
  it('shows an empty avatar when unassigned, and sizes it', () => {
    const html = renderToStaticMarkup(<Avatar size={30} />);
    expect(html).toContain('avatar-empty');
    expect(html).toContain('title="Unassigned"');
    expect(html).toContain('width:30px;height:30px');
  });
});
