import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Member } from '@buxa/contracts';
import { MembersTable } from '@/components/components/camp';
import { ROLE_TONE } from '@buxa/shared';

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
  it('colours each role pill with its own class: owner violet, admin orange, staff green, viewer blue', () => {
    const roles = ['owner', 'admin', 'staff', 'viewer'] as const;
    const rows = roles.map((role, i) => ({ id: `m-${i}`, name: `Person ${role}`, email: `${role}@example.com`, role }));
    const html = renderToStaticMarkup(<MembersTable members={rows} showEmail={false} />);
    expect(html).toMatch(/pill tone-role-owner">Owner</);
    expect(html).toMatch(/pill tone-role-admin">Admin</);
    expect(html).toMatch(/pill tone-role-staff">Staff</);
    expect(html).toMatch(/pill tone-role-viewer">Viewer</);
  });
  it('maps every camp role to a role tone', () => {
    expect(ROLE_TONE).toEqual({ owner: 'role-owner', admin: 'role-admin', staff: 'role-staff', viewer: 'role-viewer' });
  });
});
