import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Legend } from '@/components/elements/export';

describe('Legend', () => {
  it('lists each item with its swatch class', () => {
    expect(renderToStaticMarkup(<Legend items={[{ name: 'Open', className: 'seg-brand' }]} />)).toBe(
      '<div class="legend"><span><i class="sw seg-brand"></i>Open</span></div>',
    );
  });
});
