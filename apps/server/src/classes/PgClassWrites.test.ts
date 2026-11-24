import { describe, expect, it } from 'vitest';
import { deleteClassRow, insertClass, insertSession, requireInstructors, updateClassRow } from './PgClassWrites';
import { ClassNotFoundError, InstructorNotFoundError, SessionNotFoundError } from './errors';
import { fakeDb } from './__tests__/fakeDb';

const actor = {
  userId: '11111111-1111-4111-8111-111111111111',
  orgId: '22222222-2222-4222-8222-222222222222',
  role: 'owner' as const,
};
const sessionId = '55555555-5555-4555-8555-555555555555';
const classId = '88888888-8888-4888-8888-888888888888';
const personA = '66666666-6666-4666-8666-666666666666';
const personB = '77777777-7777-4777-8777-777777777777';

const classInput = {
  name: 'Robotics',
  ageRange: { minAge: 8, maxAge: 12 },
  capacity: 10,
  startsAt: '2027-07-05T09:00:00+10:00',
  endsAt: '2027-07-05T12:00:00+10:00',
  location: 'Lab 1',
  instructorIds: [],
  price: null,
};

describe('requireInstructors', () => {
  it('accepts an empty list without a statement', async () => {
    const { client, seen } = fakeDb();
    expect(await requireInstructors(client as never, [])).toEqual([]);
    expect(seen).toHaveLength(0);
  });

  it('refuses a malformed id without a statement', async () => {
    const { client, seen } = fakeDb();
    await expect(requireInstructors(client as never, [personA, 'nope'])).rejects.toBeInstanceOf(
      InstructorNotFoundError,
    );
    expect(seen).toHaveLength(0);
  });

  it('removes duplicates before it counts, so one person named twice is one instructor', async () => {
    const { client } = fakeDb(() => [{ id: personA }]);
    expect(await requireInstructors(client as never, [personA, personA])).toEqual([personA]);
  });

  it('refuses when any named person is missing from the camp (row-level security hides other camps)', async () => {
    const { client } = fakeDb(() => [{ id: personA }]);
    await expect(requireInstructors(client as never, [personA, personB])).rejects.toBeInstanceOf(
      InstructorNotFoundError,
    );
  });
});

describe('insertSession (the date range)', () => {
  it('writes the session and its session.create audit entry in the same transaction', async () => {
    const { client, seen } = fakeDb(sql => (sql.startsWith('INSERT INTO classes') ? [{ id: sessionId }] : undefined));
    const id = await insertSession(client, actor, {
      name: 'Summer camp',
      description: '',
      startsOn: '2027-07-01',
      endsOn: '2027-07-31',
    });
    expect(id).toBe(sessionId);
    expect(seen[0].sql).toMatch(/^INSERT INTO classes/);
    const audit = seen.filter(s => s.sql.startsWith('INSERT INTO audit_log'));
    expect(audit).toHaveLength(1);
    expect(audit[0]?.params).toEqual([
      actor.orgId,
      actor.userId,
      'session.create',
      'session',
      sessionId,
      { name: 'Summer camp', status: 'draft' },
    ]);
  });
});

describe('insertClass (the time range)', () => {
  it('refuses a class for a session that is not in the camp', async () => {
    const { client, seen } = fakeDb(() => []);
    await expect(insertClass(client as never, actor, sessionId, classInput)).rejects.toBeInstanceOf(
      SessionNotFoundError,
    );
    expect(seen).toHaveLength(1);
  });

  it('skips the instructor link when there are no instructors, and audits the class', async () => {
    const { client, seen } = fakeDb(sql => (sql.includes('INSERT INTO sessions') ? [{ id: classId }] : undefined));
    await insertClass(client, actor, sessionId, classInput);
    expect(seen.some(s => s.sql.includes('INSERT INTO session_instructors'))).toBe(false);
    const audit = seen.find(s => s.sql.includes('audit_log'));
    expect(audit?.params).toContain('class.create');
  });
});

describe('updateClassRow', () => {
  it('a class that is not in the camp is not found, and nothing else runs', async () => {
    const { client, seen } = fakeDb(() => []);
    await expect(updateClassRow(client, actor, classId, classInput)).rejects.toBeInstanceOf(ClassNotFoundError);
    expect(seen).toHaveLength(1);
  });

  it('replaces the instructors through the function, and audits the update', async () => {
    const { client, seen } = fakeDb(sql => {
      if (sql.startsWith('UPDATE sessions')) {
        return [{ id: classId }];
      }
      if (sql.includes('FOR UPDATE') && sql.includes('FROM sessions')) {
        return [
          { id: classId, price_minor: null, price_currency: null, early_bird_minor: null, early_bird_until: null },
        ];
      }

      return sql.includes('FROM people') ? [{ id: personA }] : undefined;
    });
    await updateClassRow(client, actor, classId, { ...classInput, instructorIds: [personA] });
    expect(seen.some(s => s.sql.includes('buxa_replace_class_instructors'))).toBe(true);
    expect(seen.find(s => s.sql.includes('audit_log'))?.params).toContain('class.update');
  });
});

describe('deleteClassRow', () => {
  it('deletes through the function and audits the delete', async () => {
    const { client, seen } = fakeDb();
    await deleteClassRow(client, actor, classId, 'Robotics');
    expect(seen[0].sql).toContain('buxa_delete_class');
    expect(seen[1].params).toEqual([actor.orgId, actor.userId, 'class.delete', 'class', classId, { name: 'Robotics' }]);
  });
});
