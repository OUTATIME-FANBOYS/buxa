import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CAMP_ROLES } from '@buxa/domain';
import { EditPersonForm, type EditablePerson } from '../EditPersonForm';

vi.mock('@buxa/server/composers/people/updatePersonAction', () => ({ updatePersonAction: async () => ({ status: 'idle' }) }));

const person: EditablePerson = {
  id: 'p-1', givenName: 'Ada', familyName: 'Lee', preferredName: 'Annie', roles: [CAMP_ROLES[0]], dateOfBirth: null, email: 'ada@example.com', phone: null,
};

describe('EditPersonForm', () => {
  it('is pre-filled from the person, with the chosen roles ticked', () => {
    const html = renderToStaticMarkup(<EditPersonForm person={person} />);
    expect(html).toContain('name="givenName" value="Ada"');
    expect(html).toContain('name="preferredName" value="Annie"');
    expect(html).toContain('name="email" value="ada@example.com"');
    expect(html.match(/checked=""/g)).toHaveLength(1);
  });
  it('lists every role and offers to save or go back to the person', () => {
    const html = renderToStaticMarkup(<EditPersonForm person={person} />);
    expect(html.match(/name="roles"/g)).toHaveLength(CAMP_ROLES.length);
    expect(html).toContain('>Save changes</button>');
    expect(html).toContain('href="/camp/people/p-1"');
  });
});
