import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Pill } from '@/components/elements';

describe('Pill', () => {
  it('uses the tone class and shows a dot by default', () => {
    expect(renderToStaticMarkup(<Pill tone="ok">Done</Pill>)).toBe(
      '<span class="pill pill-ok"><i class="pill-dot" aria-hidden="true"></i>Done</span>',
    );
  });
  it('defaults to the neutral tone and hides the dot when asked', () => {
    expect(renderToStaticMarkup(<Pill dot={false}>x</Pill>)).toBe('<span class="pill pill-neutral">x</span>');
  });
});
