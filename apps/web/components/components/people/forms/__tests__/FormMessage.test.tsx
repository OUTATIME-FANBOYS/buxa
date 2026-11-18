import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { FormMessage } from '@/components/components/people/forms/export';

describe('FormMessage', () => {
  it('shows nothing while idle', () => {
    expect(renderToStaticMarkup(<FormMessage state={{ status: 'idle' }} />)).toBe('');
  });
  it('announces a success politely', () => {
    expect(renderToStaticMarkup(<FormMessage state={{ status: 'success', message: 'Saved.' }} />)).toContain(
      'role="status"',
    );
    expect(renderToStaticMarkup(<FormMessage state={{ status: 'success' }} />)).toBe('');
  });
  it('announces an error assertively', () => {
    const html = renderToStaticMarkup(<FormMessage state={{ status: 'error', message: 'Could not save.' }} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('Could not save.');
  });
});
