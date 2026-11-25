import { describe, expect, it } from 'vitest';
import type { RegistrationForm, RegistrationRow } from '@buxa/contracts';
import { registrationSearchRows } from '../registrationSearchRows';

const form = { id: 'form-1', name: 'Season form' } as RegistrationForm;

const row = (id: string, sessions: { sessionId: string; sessionName: string }[]): RegistrationRow => ({
  id,
  formVersion: 1,
  submittedAt: '2027-06-01T00:00:00.000Z',
  status: 'pending',
  confirmedAt: null,
  withdrawnAt: null,
  archivedAt: null,
  standard: { camperFirstName: 'Ada', camperLastName: 'Lovelace' },
  custom: {},
  documents: [],
  sessions: sessions.map(s => ({ ...s, status: 'submitted' as const })),
  classes: [],
});

describe('registrationSearchRows', () => {
  it('makes one row per session a registration asks for, each pointing at that session', () => {
    const rows = registrationSearchRows([
      {
        form,
        rows: [
          row('reg-1', [
            { sessionId: 'summer', sessionName: 'Summer camp' },
            { sessionId: 'autumn', sessionName: 'Autumn camp' },
          ]),
        ],
      },
    ]);
    expect(rows.map(r => [r.sessionId, r.sessionName])).toEqual([
      ['summer', 'Summer camp'],
      ['autumn', 'Autumn camp'],
    ]);
    expect(rows.every(r => r.formName === 'Season form' && r.camperName === 'Ada Lovelace')).toBe(true);
  });

  it('gives each row a key unique to its registration and session', () => {
    const rows = registrationSearchRows([
      {
        form,
        rows: [
          row('reg-1', [
            { sessionId: 'summer', sessionName: 'Summer camp' },
            { sessionId: 'autumn', sessionName: 'Autumn camp' },
          ]),
        ],
      },
    ]);
    expect(new Set(rows.map(r => r.id)).size).toBe(2);
  });

  it('returns no rows when there are no registrations', () => {
    expect(registrationSearchRows([{ form, rows: [] }])).toEqual([]);
  });
});
