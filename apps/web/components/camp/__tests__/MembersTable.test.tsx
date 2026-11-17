import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Member } from '@buxa/contracts';
import { MembersTable } from '../MembersTable';

const members = [{ id: 'm-1', name: 'Rosa Delgado', email: 'rosa@example.com', role: 'owner' }] as unknown as Member[];

describe('MembersTable', () => {
  it('shows names and roles, and the email only where the reader may see it', () => {
    const shown = renderToStaticMarkup(<MembersTable members={members} showEmail />);
    expect(shown).toContain('<th>Email</th>');
    expect(shown).toContain('rosa@example.com');
    const hidden = renderToStaticMarkup(<MembersTable members={members} showEmail={false} />);
    expect(hidden).not.toContain('rosa@example.com');
    expect(hidden).toContain('Rosa Delgado');
  });
  it('marks the owner with the brand pill', () => {
    expect(renderToStaticMarkup(<MembersTable members={members} showEmail={false} />)).toContain('pill-brand');
  });
});
