import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Pill } from '@/components/elements';

describe('Pill', () => {
  it('uses the tone class and shows a dot by default', () => {
    expect(renderToStaticMarkup(<Pill tone="ok">Done</Pill>)).toMatch(
      /^<span class="pill tone-ok"><i class="pill-dot" aria-hidden="true"><\/i>Done<\/span>$/,
    );
  });
  it('defaults to the neutral tone and hides the dot when asked', () => {
    expect(renderToStaticMarkup(<Pill dot={false}>x</Pill>)).toMatch(/^<span class="pill tone-neutral">x<\/span>$/);
  });
  it('takes the role tone for a camp role, so each role has its own hue', () => {
    expect(
      renderToStaticMarkup(
        <Pill tone="role-owner" dot={false}>
          Owner
        </Pill>,
      ),
    ).toMatch(/class="pill tone-role-owner"/);
  });
});
