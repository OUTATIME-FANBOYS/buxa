import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { UnlinkButton } from '@/components/components/people/forms';
import { settle } from '@buxa/domain';

vi.mock('@buxa/server/composers/people/unlinkHouseholdAction', () => ({
  unlinkHouseholdAction: () => settle(() => ({ status: 'idle' })),
}));

describe('UnlinkButton', () => {
  it('removes the named person from the household, with the name in the accessible label', () => {
    const html = renderToStaticMarkup(<UnlinkButton householdId="h-1" personId="p-2" name="Jo Cole" />);
    expect(html).toContain('aria-label="Remove Jo Cole from this household"');
    expect(html).toContain('name="householdId" value="h-1"');
    expect(html).toContain('>Remove</button>');
  });
});
