import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CAMP_ROLES, CAMP_ROLE_LABELS } from '@buxa/domain';
import { RolePills } from '../RolePills';

describe('RolePills', () => {
  it('shows each role with its label', () => {
    const [first, second] = CAMP_ROLES;
    const html = renderToStaticMarkup(<RolePills roles={[first, second]} />);
    expect(html).toContain(CAMP_ROLE_LABELS[first]);
    expect(html).toContain(CAMP_ROLE_LABELS[second]);
  });
  it('says there are no roles when there are none', () => {
    expect(renderToStaticMarkup(<RolePills roles={[]} />)).toBe('<span class="muted">No roles</span>');
  });
});
