import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { NewCampForm } from '@/components/components/camp/export';
import { settle } from '@buxa/domain';

vi.mock('@buxa/server/composers/camp/createCampAction', () => ({ createCampAction: () => settle(() => ({ status: 'idle' })) }));

describe('NewCampForm', () => {
  it('is the first-run set-up screen when there are no camps yet', () => {
    const html = renderToStaticMarkup(<NewCampForm first />);
    expect(html).toContain('<h1>Set up your camp</h1>');
    expect(html).toContain('class="setup"');
    expect(html).not.toContain('>Cancel</a>');
  });
  it('is an extra camp form with a way back to the camp otherwise', () => {
    const html = renderToStaticMarkup(<NewCampForm first={false} />);
    expect(html).toContain('<h1>New camp</h1>');
    expect(html).toContain('href="/camp"');
    expect(html).toContain('>Cancel</a>');
  });
  it('asks for a name and an address for the camp', () => {
    const html = renderToStaticMarkup(<NewCampForm first />);
    expect(html).toContain('>Camp name</span>');
    expect(html).toContain('>Address</span>');
    expect(html).toContain('>Create camp</button>');
  });
});
