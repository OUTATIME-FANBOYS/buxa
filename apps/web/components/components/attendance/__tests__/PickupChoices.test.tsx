import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PickupChoices } from '@/components/components/attendance/export';

const options = [
  { personId: 'g-1', name: 'Jo Cole', relationship: 'Mother' },
  { personId: 'g-2', name: 'Sam Cole', relationship: 'Father' },
];

describe('PickupChoices', () => {
  it('lists each guardian as a radio in one group, with the chosen one checked', () => {
    const html = renderToStaticMarkup(
      <PickupChoices name="collector" options={options} value="g-2" onChange={() => undefined} />,
    );
    expect(html).toContain('<legend class="field-label">Who is collecting?</legend>');
    expect(html.match(/type="radio" name="collector"/g)).toHaveLength(2);
    expect(html.match(/checked=""/g)).toHaveLength(1);
    expect(html.indexOf('value="g-2"')).toBeGreaterThan(html.indexOf('checked=""') - 200);
    expect(html).toContain('Mother');
  });
  it('is usable without a choice made yet', () => {
    const onChange = vi.fn();
    const html = renderToStaticMarkup(
      <PickupChoices name="collector" options={options} value={null} onChange={onChange} />,
    );
    expect(html).not.toContain('checked=""');
  });
});
