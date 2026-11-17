import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AddMembershipForm } from '../AddMembershipForm';

vi.mock('@/logic/composers/people/addMembershipAction', () => ({ addMembershipAction: async () => ({ status: 'idle' }) }));

describe('AddMembershipForm', () => {
  it('asks for a plan and the first and last camp days, for the person', () => {
    const html = renderToStaticMarkup(<AddMembershipForm personId="p-1" />);
    expect(html).toContain('<h3 class="people-subheading">Add a membership</h3>');
    expect(html).toContain('>Plan</span>');
    expect(html).toContain('>Starts on</span>');
    expect(html).toContain('>Ends on</span>');
    expect(html).toContain('name="personId" value="p-1"');
    expect(html).toContain('>Add membership</button>');
  });
});
