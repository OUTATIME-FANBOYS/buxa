import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AuthHero } from '@/components/components/auth';

describe('AuthHero', () => {
  it('is decorative: hidden from assistive technology, with the brand and the three promises', () => {
    const html = renderToStaticMarkup(<AuthHero />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('Run your camp from one place.');
    expect(html.match(/<li>/g)).toHaveLength(3);
  });
});
