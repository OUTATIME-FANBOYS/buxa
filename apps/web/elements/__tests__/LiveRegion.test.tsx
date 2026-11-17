import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LiveRegion } from '../LiveRegion';

describe('LiveRegion', () => {
  it('is a visually hidden polite status that carries the message', () => {
    expect(renderToStaticMarkup(<LiveRegion message="Ada checked in" />)).toBe(
      '<div class="sr-only" role="status" aria-live="polite" aria-atomic="true">Ada checked in</div>',
    );
  });
});
