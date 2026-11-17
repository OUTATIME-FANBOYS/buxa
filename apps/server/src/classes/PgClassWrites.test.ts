import { describe, expect, it } from 'vitest';
import { insertClass, insertSession, requireInstructors } from './PgClassWrites';
import { ClassNotFoundError, InstructorNotFoundError } from './errors';
import { fakeDb } from './__tests__/fakeDb';

const actor = { userId: '11111111-1111-4111-8111-111111111111', orgId: '22222222-2222-4222-8222-222222222222', role: 'owner' as const };
const classId = '55555555-5555-4555-8555-555555555555';
const personA = '66666666-6666-4666-8666-666666666666';
const personB = '77777777-7777-4777-8777-777777777777';

describe('requireInstructors', () => {
  it('accepts an empty list without a statement', async () => {
    const { client, seen } = fakeDb();
    expect(await requireInstructors(client as never, [])).toEqual([]);
    expect(seen).toHaveLength(0);
  });

  it('refuses a malformed id without a statement', async () => {
    const { client, seen } = fakeDb();
    await expect(requireInstructors(client as never, [personA, 'nope'])).rejects.toBeInstanceOf(InstructorNotFoundError);
    expect(seen).toHaveLength(0);
  });

  it('removes duplicates before it counts, so one person named twice is one instructor', async () => {
    const { client } = fakeDb(() => [{ id: personA }]);
    expect(await requireInstructors(client as never, [personA, personA])).toEqual([personA]);
  });

  it('refuses when any named person is missing from the camp (row-level security hides other camps)', async () => {
    const { client } = fakeDb(() => [{ id: personA }]);
    await expect(requireInstructors(client as never, [personA, personB])).rejects.toBeInstanceOf(InstructorNotFoundError);
  });
});

describe('insertClass', () => {
  it('writes the class and its class.create audit entry in the same transaction, scoped to the actor camp', async () => {
    const { client, seen } = fakeDb(sql => (sql.startsWith('INSERT INTO classes') ? [{ id: classId }] : undefined));
    const id = await insertClass(client, actor, {
      name: 'Robotics', description: '', ageRange: { minAge: 8, maxAge: 12 }, capacity: 10, instructorRatio: null,
    });
    expect(id).toBe(classId);
    expect(seen).toHaveLength(2);
    expect(seen[0].sql).toMatch(/^INSERT INTO classes/);
    expect(seen[1].sql).toMatch(/^INSERT INTO audit_log/);
    expect(seen[1].params).toEqual([actor.orgId, actor.userId, 'class.create', 'class', classId, { name: 'Robotics' }]);
  });
});

describe('insertSession', () => {
  const input = {
    startsAt: '2027-07-05T09:00:00+10:00', endsAt: '2027-07-05T12:00:00+10:00', location: 'Lab 1', instructorIds: [], capacity: 5,
  };

  it('refuses a session for a class that is not in the camp', async () => {
    const { client, seen } = fakeDb(() => []);
    await expect(insertSession(client as never, actor, classId, input)).rejects.toBeInstanceOf(ClassNotFoundError);
    expect(seen).toHaveLength(1);
  });

  it('skips the instructor link when there are no instructors', async () => {
    const { client, seen } = fakeDb(sql => (sql.includes('INSERT INTO sessions') ? [{ id: classId }] : undefined));
    await insertSession(client, actor, classId, input);
    expect(seen.some(s => s.sql.includes('session_instructors'))).toBe(false);
    expect(seen.at(-1)?.sql).toMatch(/audit_log/);
  });
});
