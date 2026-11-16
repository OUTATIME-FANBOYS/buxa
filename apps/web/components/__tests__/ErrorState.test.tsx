import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ErrorState } from '../ErrorState';

describe('ErrorState', () => {
  afterEach(() => vi.restoreAllMocks());

  it('says the page could not load and shows the reference for support', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const error = Object.assign(new Error('boom'), { digest: 'abc123' });
    const html = renderToStaticMarkup(<ErrorState error={error} reset={() => undefined} />);
    expect(html).toContain('Could not load this');
    expect(html).toContain('Reference: abc123');
    expect(html).toContain('>Try again</button>');
  });
  it('logs the error to the console and gives a plain message without a reference', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const error = new Error('boom');
    const html = renderToStaticMarkup(<ErrorState error={error} reset={() => undefined} />);
    expect(log).toHaveBeenCalledWith(error);
    expect(html).toContain('Something went wrong on our side.');
    expect(html).not.toContain('Reference');
  });
});
