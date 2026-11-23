import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AddMembershipForm } from '@/components/components/people/forms';
import { settle } from '@buxa/domain';

vi.mock('@buxa/server/composers/people/addMembershipAction', () => ({
  addMembershipAction: () => settle(() => ({ status: 'idle' })),
}));

describe('AddMembershipForm', () => {
  it('asks for a plan and the first and last camp days, for the person', () => {
    const html = renderToStaticMarkup(<AddMembershipForm personId="p-1" />);
    expect(html).toContain('<h3 class="people-subheading">Add a membership</h3>');
    expect(html).toMatch(/<label[^>]*>Plan<\/label>/);
    expect(html).toMatch(/<label[^>]*>Starts on<\/label>/);
    expect(html).toMatch(/<label[^>]*>Ends on<\/label>/);
    expect(html).toContain('name="personId" value="p-1"');
    expect(html).toContain('>Add membership</button>');
  });

  it('gives every field the same parts (label, input, helper line) in one grid, and a primary submit', () => {
    const html = renderToStaticMarkup(<AddMembershipForm personId="p-1" />);
    expect(html).toContain('people-form-grid people-membership-fields');
    expect(html).toContain('The first camp day, included.');
    expect(html).toContain('The last camp day, included.');
    const submitTag = /<button([^>]*)>Add membership<\/button>/.exec(html)?.[1] ?? '';
    expect(submitTag).toContain('button--primary');
    expect(html).not.toContain('button--sm');
  });
});
