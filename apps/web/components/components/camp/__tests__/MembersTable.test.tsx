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
    const rows = roles.map((role, i) => ({
      id: `m-${i}`,
      name: `Person ${role}`,
      email: `${role}@example.com`,
      role,
      expiresAt: null,
    }));
    const html = renderToStaticMarkup(<MembersTable members={rows} showEmail={false} />);
    expect(html).toMatch(/pill tone-role-owner">Owner</);
    expect(html).toMatch(/pill tone-role-admin">Admin</);
    expect(html).toMatch(/pill tone-role-staff">Staff</);
    expect(html).toMatch(/pill tone-role-viewer">Viewer</);
  });
  it('maps every camp role to a role tone', () => {
    expect(ROLE_TONE).toEqual({
      owner: 'role-owner',
      admin: 'role-admin',
      staff: 'role-staff',
      viewer: 'role-viewer',
      teacher: 'role-teacher',
    });
  });
  it('shows a check-in switch only for the teachers the reader may change, and no column without them', () => {
    const rows = [
      { id: 'm-t', name: 'Ana Ruiz', email: 'ana@example.com', role: 'teacher' },
      { id: 'm-s', name: 'Sam Lee', email: 'sam@example.com', role: 'staff' },
    ] as unknown as Member[];
    const none = renderToStaticMarkup(<MembersTable members={rows} showEmail={false} />);
    expect(none).not.toContain('Check-in and check-out');
    expect(none).not.toContain('type="checkbox"');

    const withSwitch = renderToStaticMarkup(
      <MembersTable members={rows} showEmail={false} teacherOptions={[{ userId: 'm-t', on: true }]} />,
    );
    expect(withSwitch).toContain('Check-in and check-out');
    expect(withSwitch.match(/type="checkbox"/g)).toHaveLength(1);
    expect(withSwitch).toContain('Check in and out, for');
    expect(withSwitch).toMatch(/type="checkbox"[^>]*checked/);
  });

  describe('team access expiry pills', () => {
    const daysFromNow = (days: number) => new Date(Date.now() + days * 86400000).toISOString();
    const row = (expiresAt: string | null) =>
      [{ id: 'm-x', name: 'Ines Park', email: 'ines@example.com', role: 'staff', expiresAt }] as unknown as Member[];

    it('shows an Expired pill for a membership whose expiry is in the past', () => {
      const html = renderToStaticMarkup(<MembersTable members={row(daysFromNow(-1))} showEmail={false} />);
      expect(html).toContain('>Expired<');
    });

    it('shows Expires with the date for an expiry within 14 days', () => {
      const soon = daysFromNow(5);
      const html = renderToStaticMarkup(<MembersTable members={row(soon)} showEmail={false} />);
      expect(html).toMatch(/Expires [A-Z][a-z]{2} \d{1,2}, \d{4}/);
      expect(html).not.toContain('>Expired<');
    });

    it('shows neither pill when there is no expiry, or it is more than 14 days away', () => {
      const none = renderToStaticMarkup(<MembersTable members={row(null)} showEmail={false} />);
      expect(none).not.toContain('Expire');
      const later = renderToStaticMarkup(<MembersTable members={row(daysFromNow(60))} showEmail={false} />);
      expect(later).not.toContain('Expire');
    });
  });
});
