import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PersonForm } from '@/components/components/people/forms';
import { ADD_PERSON_INTRO } from '@buxa/shared';
import { settle } from '@buxa/domain';

vi.mock('@buxa/server/composers/people/createPersonAction', () => ({
  createPersonAction: () => settle(() => ({ status: 'idle' })),
}));

describe('PersonForm (create): the static frame', () => {
  it('has no Preferred name, and calls the second name field Last name', () => {
    const html = renderToStaticMarkup(<PersonForm mode="create" household={null} households={[]} />);
    expect(html).not.toContain('Preferred name');
    expect(html).not.toContain('Family name');
    expect(html).toContain('Last name');
    expect(html).toContain('First name');
  });

  it('puts Date of birth and Phone on one half-width row, and drops the Contact and age heading', () => {
    const html = renderToStaticMarkup(<PersonForm mode="create" household={null} households={[]} />);
    expect(html).toMatch(/class="people-form-half"[^>]*>[\s\S]*Date of birth[\s\S]*Phone/);
    expect(html).not.toContain('Contact and age');
  });

  it('shows the roles as two headed groups, with the same role names', () => {
    const html = renderToStaticMarkup(<PersonForm mode="create" household={null} households={[]} />);
    expect(html).toContain('Family');
    expect(html).toContain('Staff and participants');
    expect(html).toContain('Parent or guardian');
    expect(html).toContain('Choose one. Select it again to clear it.');
    expect(html).not.toContain('Choose everything that applies.');
  });

  it('shows no Household section and no Email field before a role is chosen', () => {
    const html = renderToStaticMarkup(<PersonForm mode="create" household={null} households={[]} />);
    expect(html).not.toContain('>Household</legend>');
    expect(html).not.toContain('name="email"');
    expect(html).not.toContain('name="householdEmail"');
  });

  it('has no Name heading and no intro line at the top: the intro sits in the Household section only', () => {
    const html = renderToStaticMarkup(<PersonForm mode="create" household={null} households={[]} />);
    expect(html).not.toContain('>Name</legend>');
    expect(html).not.toContain(ADD_PERSON_INTRO);
  });

  it('on its own page it keeps the panel and a Cancel link back to People', () => {
    const html = renderToStaticMarkup(<PersonForm mode="create" household={null} households={[]} />);
    expect(html).toContain('class="panel people-form person-form"');
    expect(html).toContain('href="/camp/people"');
  });

  it('in the dialog it has no footer of its own: the pop-up footer submits it', () => {
    const html = renderToStaticMarkup(
      <PersonForm mode="create" household={null} households={[]} variant="dialog" formId="x" />,
    );
    expect(html).toContain('<form id="x"');
    expect(html).not.toContain('person-actions');
    expect(html).not.toContain('href="/camp/people"');
  });
});
