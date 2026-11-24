import { describe, expect, it } from 'vitest';
import { isHttpError } from '../http/errors';
import { CAMPER_ADA, JULY_SESSION, as, classAt, monday9to12, robotics, setup } from './__tests__/fixtures';

// The session lifecycle: a new session is a draft, an admin or the owner takes it live, and an archived session is closed. A draft
// takes no enrolment and is deleted with everything under it; a live session is deleted only once nobody is enrolled.

const expect403 = async (p: Promise<unknown>) => {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(isHttpError(err) && err.statusCode).toBe(403);
};

async function draftWithClass(ctx: ReturnType<typeof setup>) {
  const created = await ctx.service.createSession(as('admin'), JULY_SESSION);
  if (!created.ok) {
    throw new Error(created.failure.message);
  }
  const added = await ctx.service.addClass(as('admin'), created.value.id, classAt(robotics, monday9to12));
  if (!added.ok) {
    throw new Error(added.failure.message);
  }

  return { sessionId: created.value.id, classId: added.value.id };
}

const enrolAda = (ctx: ReturnType<typeof setup>, classId: string) =>
  ctx.service.enrol(as('staff'), { classId, camperId: CAMPER_ADA, waitlistIfFull: false });

describe('a new session is a draft', () => {
  it('starts as a draft with no archive time', async () => {
    const ctx = setup();
    const created = await ctx.service.createSession(as('staff'), JULY_SESSION);
    expect(created).toMatchObject({ ok: true, value: { status: 'draft', archivedAt: null } });
  });

  it('refuses enrolment while it is a draft, and writes nothing', async () => {
    const ctx = setup();
    const { classId } = await draftWithClass(ctx);

    const refused = await enrolAda(ctx, classId);

    expect(refused).toMatchObject({ ok: false, failure: { reason: 'session_not_live' } });
    expect(refused.ok === false && refused.failure.message).toContain('Go live');
    expect(ctx.repo.audit.some(a => a.action === 'enrolment.create')).toBe(false);
  });
});

describe('go live', () => {
  it('opens enrolment, and is audited', async () => {
    const ctx = setup();
    const { sessionId, classId } = await draftWithClass(ctx);

    const live = await ctx.service.publishSession(as('admin'), sessionId);

    expect(live).toMatchObject({ ok: true, value: { status: 'live' } });
    expect((await enrolAda(ctx, classId)).ok).toBe(true);
    expect(ctx.repo.audit.filter(a => a.action === 'session.publish')).toHaveLength(1);
  });

  it('is for admin and owner: staff, a viewer and a teacher are refused with a 403', async () => {
    const ctx = setup();
    const { sessionId } = await draftWithClass(ctx);
    await expect403(ctx.service.publishSession(as('staff'), sessionId));
    await expect403(ctx.service.publishSession(as('viewer'), sessionId));
    await expect403(ctx.service.publishSession(as('teacher'), sessionId));
    expect((await ctx.service.publishSession(as('owner'), sessionId)).ok).toBe(true);
  });

  it('leaves a live session as it is, writes no second audit entry, and refuses an archived one', async () => {
    const ctx = setup();
    const { sessionId } = await draftWithClass(ctx);
    await ctx.service.publishSession(as('admin'), sessionId);
    expect(await ctx.service.publishSession(as('admin'), sessionId)).toMatchObject({
      ok: true,
      value: { status: 'live' },
    });
    expect(ctx.repo.audit.filter(a => a.action === 'session.publish')).toHaveLength(1);

    await ctx.service.setSessionArchived(as('staff'), sessionId, true);
    expect(await ctx.service.publishSession(as('admin'), sessionId)).toMatchObject({
      ok: false,
      failure: { reason: 'session_not_draft' },
    });
  });
});

describe('archive and unarchive', () => {
  it('closes a live session to enrolment and keeps its classes; unarchive makes it live again', async () => {
    const ctx = setup();
    const { sessionId, classId } = await draftWithClass(ctx);
    await ctx.service.publishSession(as('admin'), sessionId);

    const archived = await ctx.service.setSessionArchived(as('staff'), sessionId, true);
    expect(archived).toMatchObject({ ok: true, value: { status: 'archived' } });
    expect(archived.ok && archived.value.archivedAt).not.toBeNull();
    expect(await enrolAda(ctx, classId)).toMatchObject({ ok: false, failure: { reason: 'session_not_live' } });
    expect((await ctx.service.listClasses(as('admin'), sessionId)).ok).toBe(true);

    const back = await ctx.service.setSessionArchived(as('admin'), sessionId, false);
    expect(back).toMatchObject({ ok: true, value: { status: 'live', archivedAt: null } });
    expect((await enrolAda(ctx, classId)).ok).toBe(true);
  });

  it('unarchiving a session that is not archived changes nothing (a draft stays a draft)', async () => {
    const ctx = setup();
    const { sessionId } = await draftWithClass(ctx);
    const outcome = await ctx.service.setSessionArchived(as('admin'), sessionId, false);
    expect(outcome).toMatchObject({ ok: true, value: { status: 'draft' } });
    expect(ctx.repo.audit.some(a => a.action === 'session.unarchive')).toBe(false);
  });
});

describe('delete', () => {
  it('a draft is deleted with its classes after the typed name, and audited', async () => {
    const ctx = setup();
    const { sessionId } = await draftWithClass(ctx);

    const impact = await ctx.service.sessionDeleteImpact(as('admin'), sessionId);
    expect(impact).toMatchObject({ ok: true, value: { classes: 1 } });
    expect(await ctx.service.deleteSessionWithClasses(as('admin'), sessionId, 'wrong')).toMatchObject({
      ok: false,
      failure: { reason: 'session_name_confirmation' },
    });
    expect((await ctx.service.getSession(as('admin'), sessionId)).ok).toBe(true);

    const done = await ctx.service.deleteSessionWithClasses(as('admin'), sessionId, JULY_SESSION.name);

    expect(done.ok).toBe(true);
    expect((await ctx.service.getSession(as('admin'), sessionId)).ok).toBe(false);
    expect(ctx.repo.audit.map(a => a.action)).toEqual(expect.arrayContaining(['class.delete', 'session.delete']));
    const deleted = ctx.repo.audit.find(a => a.action === 'session.delete');
    expect(deleted?.data).toMatchObject({ name: JULY_SESSION.name, status: 'draft', classes: 1 });
  });

  it('what a draft delete would remove is for admin and owner only', async () => {
    const ctx = setup();
    const { sessionId } = await draftWithClass(ctx);
    await expect403(ctx.service.sessionDeleteImpact(as('staff'), sessionId));
    await expect403(ctx.service.deleteSessionWithClasses(as('staff'), sessionId, JULY_SESSION.name));
  });

  it('a live session with an enrolment is refused with the unenrol message, and keeps everything', async () => {
    const ctx = setup();
    const { sessionId, classId } = await draftWithClass(ctx);
    await ctx.service.publishSession(as('admin'), sessionId);
    await enrolAda(ctx, classId);

    const refused = await ctx.service.deleteSessionWithClasses(as('admin'), sessionId, JULY_SESSION.name);

    expect(refused).toMatchObject({ ok: false, failure: { reason: 'session_has_enrolments' } });
    expect(refused.ok === false && refused.failure.message).toContain('Unenrol every student first');
    expect(refused.ok === false && refused.failure.message).toContain('refunds');
    expect((await ctx.service.getSession(as('admin'), sessionId)).ok).toBe(true);
    expect(ctx.repo.audit.some(a => a.action === 'session.delete')).toBe(false);
  });

  it('a live session with no enrolments is still deleted by the existing path', async () => {
    const ctx = setup();
    const { sessionId } = await draftWithClass(ctx);
    await ctx.service.publishSession(as('admin'), sessionId);
    const done = await ctx.service.deleteSessionWithClasses(as('admin'), sessionId, JULY_SESSION.name);
    expect(done.ok).toBe(true);
  });
});
