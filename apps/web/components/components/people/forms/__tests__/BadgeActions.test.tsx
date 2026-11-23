import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BadgeActions, type BadgeActionsProps } from '@/components/components/people/forms';

const noop = vi.fn();
const base: BadgeActionsProps = {
  active: false,
  busy: false,
  onShow: noop,
  onReprint: noop,
  onIssue: noop,
  onRevoke: noop,
};

describe('BadgeActions', () => {
  it('offers one primary Issue badge when there is no active badge, and nothing else', () => {
    const html = renderToStaticMarkup(<BadgeActions {...base} />);
    expect(html).toContain('>Issue badge</button>');
    expect(html.match(/<button/g)).toHaveLength(1);
    expect(html).not.toContain('Revoke');
    expect(html).not.toContain('Reprint');
  });

  it('shows Show badge, Reprint, Reissue and Revoke in that order, with no icons', () => {
    const html = renderToStaticMarkup(<BadgeActions {...base} active />);
    const labels = [...html.matchAll(/<button[^>]*>([^<]*)<\/button>/g)].map(m => m[1]);
    expect(labels).toEqual(['Show badge', 'Reprint', 'Reissue', 'Revoke']);
    expect(html).not.toContain('<svg');
  });

  it('gives each action its own style: secondary, secondary, primary, danger-soft', () => {
    const html = renderToStaticMarkup(<BadgeActions {...base} active />);
    const buttons = [...html.matchAll(/<button([^>]*)>([^<]*)<\/button>/g)].map(m => ({
      label: m[2],
      classes: /class="([^"]*)"/.exec(m[1])?.[1] ?? '',
    }));
    const variant = (label: string) => buttons.find(b => b.label === label)?.classes ?? '';
    expect(variant('Show badge')).toContain('secondary');
    expect(variant('Reprint')).toContain('secondary');
    expect(variant('Reissue')).toContain('primary');
    expect(variant('Revoke')).toContain('danger-soft');
  });

  it('disables every button while a badge action runs', () => {
    const html = renderToStaticMarkup(<BadgeActions {...base} active busy />);
    expect(html.match(/disabled=""/g)).toHaveLength(4);
  });
});
