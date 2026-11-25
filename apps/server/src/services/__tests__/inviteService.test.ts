import { describe, expect, it } from 'vitest';
import type { Actor, Role } from '@buxa/domain';
import { InMemoryMemberInviteRepository } from '../../invites/InMemoryMemberInviteRepository';
import { hashInviteToken, looksLikeInviteToken } from '../../invites/inviteToken';
import { isHttpError } from '../../http/errors';
import { createInviteService } from '../invites/createInviteService';

const ORG = '11111111-1111-4111-8111-111111111111';
const CAMP = new Map([[ORG, 'Camp Pine']]);
const DAY_MS = 24 * 60 * 60 * 1000;
const START = new Date('2027-07-01T09:00:00Z');

/** `teacher` is a viewer whose person is an instructor (migration 0069): the teaching view. */
const actor = (role: Role | 'teacher', userId = `user-${role}`): Actor =>
  role === 'teacher' ? { userId, orgId: ORG, role: 'viewer', instructor: true } : { userId, orgId: ORG, role };
const ann = { userId: 'user-ann', email: 'ann@example.test' };
const invitee = { name: 'Ann Lee', email: 'ann@example.test', phone: '+61 400 000 000' };

function setup() {
  let now = START;
  const repo = new InMemoryMemberInviteRepository(CAMP, () => now);
  const service = createInviteService({ invites: repo });

  return {
    repo,
    service,
    setNow: (at: Date) => {
      now = at;
    },
  };
}

/** The HTTP refusal a promise ends with. Fails the test if it succeeds or fails for another reason. */
async function refusalOf(work: Promise<unknown>): Promise<{ status: number; message: string }> {
  try {
    await work;
  } catch (error) {
    if (isHttpError(error)) {
      return { status: error.statusCode, message: error.message };
    }
    throw error;
  }
  throw new Error('expected the call to be refused');
}

const profile = { firstName: 'Ann', lastName: 'Lee', phone: '+61 400 000 000' };

describe('teacher invites: who may create one', () => {
  it.each<Role>(['staff', 'admin', 'owner'])('%s may create a teacher invite', async role => {
    const { service } = setup();
    const issued = await service.createTeacherInvite(actor(role), invitee);

    expect(issued.invite.email).toBe('ann@example.test');
  });

  it.each<Role | 'teacher'>(['viewer', 'teacher'])('%s is refused', async role => {
    const { service, repo } = setup();
    const refused = await refusalOf(service.createTeacherInvite(actor(role), invitee));

    expect(refused.status).toBe(403);
    expect(repo.invites).toHaveLength(0);
  });

  it('lists only pending invites of the camp, without tokens', async () => {
    const { service } = setup();
    const issued = await service.createTeacherInvite(actor('staff'), invitee);
    const listed = await service.listPendingInvites(actor('admin'));

    expect(listed.map(i => i.id)).toEqual([issued.invite.id]);
    expect(JSON.stringify(listed)).not.toContain(issued.token);
    expect(await refusalOf(service.listPendingInvites(actor('viewer')))).toMatchObject({ status: 403 });
  });
});

describe('teacher invites: what is stored', () => {
  it('stores the token only as its SHA-256 hash, and returns the raw token once', async () => {
    const { service, repo } = setup();
    const issued = await service.createTeacherInvite(actor('staff'), invitee);

    expect(looksLikeInviteToken(issued.token)).toBe(true);
    expect(repo.invites[0]?.tokenHash.equals(hashInviteToken(issued.token))).toBe(true);
    // The raw token is in no stored field: not in the invite row, and not in the audit log.
    expect(JSON.stringify(repo.invites)).not.toContain(issued.token);
    expect(JSON.stringify(repo.audit)).not.toContain(issued.token);
    expect(JSON.stringify(repo.audit)).not.toContain(hashInviteToken(issued.token).toString('hex'));
  });

  it('stores the name and phone the inviter typed, and an empty phone as none', async () => {
    const { service } = setup();
    const withPhone = await service.createTeacherInvite(actor('staff'), invitee);
    const withoutPhone = await service.createTeacherInvite(actor('staff'), { ...invitee, phone: '' });

    expect(withPhone.invite).toMatchObject({ name: 'Ann Lee', phone: '+61 400 000 000' });
    expect(withoutPhone.invite.phone).toBeNull();
  });

  it('audits member.invite with the role and no token, name, email or phone', async () => {
    const { service, repo } = setup();
    const issued = await service.createTeacherInvite(actor('staff', 'user-staff'), invitee);

    expect(repo.audit).toEqual([
      {
        action: 'member.invite',
        orgId: ORG,
        actorId: 'user-staff',
        entityId: issued.invite.id,
        data: { role: 'teacher' },
      },
    ]);
  });
});

describe('teacher invites: accepting', () => {
  it('joins the signed-in person as a teacher and saves their profile to their own row only', async () => {
    const { service, repo } = setup();
    const issued = await service.createTeacherInvite(actor('staff'), invitee);
    // Another person's profile already exists; a join for Ann must not change it.
    repo.profiles.set('user-other', { firstName: 'Bo', lastName: null, phone: null });

    const joined = await service.acceptInvite(ann, issued.token, profile);

    expect(joined).toEqual({ orgId: ORG, orgName: 'Camp Pine' });
    expect(repo.joins).toEqual([{ orgId: ORG, userId: 'user-ann', role: 'teacher' }]);
    expect([...repo.profiles.keys()].sort()).toEqual(['user-ann', 'user-other']);
    expect(repo.profiles.get('user-ann')).toEqual(profile);
    expect(repo.profiles.get('user-other')).toEqual({ firstName: 'Bo', lastName: null, phone: null });
    expect(repo.invites[0]?.acceptedAt).not.toBeNull();
    expect(repo.audit.at(-1)).toMatchObject({ action: 'member.invite_accept', actorId: 'user-ann' });
  });

  it('pre-fills the join from the invite name and phone, and says whether the email matches', async () => {
    const { service } = setup();
    const issued = await service.createTeacherInvite(actor('staff'), invitee);

    expect(await service.previewInvite(ann, issued.token)).toEqual({
      kind: 'ready',
      orgName: 'Camp Pine',
      name: 'Ann Lee',
      phone: '+61 400 000 000',
    });
    expect(await service.previewInvite({ userId: 'user-bo', email: 'bo@example.test' }, issued.token)).toEqual({
      kind: 'wrong-email',
    });
  });

  it('refuses a different email, and writes nothing (no membership, no profile, not accepted)', async () => {
    const { service, repo } = setup();
    const issued = await service.createTeacherInvite(actor('staff'), invitee);
    const refused = await refusalOf(
      service.acceptInvite({ userId: 'user-bo', email: 'bo@example.test' }, issued.token, profile),
    );

    expect(refused).toEqual({ status: 403, message: 'This invite is for another email address.' });
    expect(repo.joins).toHaveLength(0);
    expect(repo.profiles.size).toBe(0);
    expect(repo.invites[0]?.acceptedAt).toBeNull();
  });

  it('refuses an expired invite with the one generic message', async () => {
    const { service, setNow } = setup();
    const issued = await service.createTeacherInvite(actor('staff'), invitee);
    setNow(new Date(START.getTime() + 8 * DAY_MS));

    const refused = await refusalOf(service.acceptInvite(ann, issued.token, profile));

    expect(refused.status).toBe(404);
    expect(refused.message).toBe('This invite cannot be used. Ask the camp for a new one.');
    expect(await service.previewInvite(ann, issued.token)).toBeNull();
  });

  it('refuses an invite that was already used, with the same generic message', async () => {
    const { service } = setup();
    const issued = await service.createTeacherInvite(actor('staff'), invitee);
    await service.acceptInvite(ann, issued.token, profile);

    const again = await refusalOf(service.acceptInvite(ann, issued.token, profile));

    expect(again).toEqual({ status: 404, message: 'This invite cannot be used. Ask the camp for a new one.' });
  });

  it('refuses a token that is not an invite token, without looking it up', async () => {
    const { service } = setup();

    expect((await refusalOf(service.acceptInvite(ann, 'not-a-token', profile))).status).toBe(404);
    expect(await service.previewInvite(ann, 'not-a-token')).toBeNull();
  });

  it('refuses a person who is already in the camp, and changes nothing', async () => {
    const { service, repo } = setup();
    const first = await service.createTeacherInvite(actor('staff'), invitee);
    await service.acceptInvite(ann, first.token, profile);
    const second = await service.createTeacherInvite(actor('staff'), invitee);

    const refused = await refusalOf(service.acceptInvite(ann, second.token, { ...profile, firstName: 'Changed' }));

    expect(refused).toEqual({ status: 409, message: 'You are already in this camp.' });
    expect(repo.profiles.get('user-ann')).toEqual(profile);
  });
});

describe('teacher invites: sending again', () => {
  it('replaces the token: the old link stops working and the new one joins', async () => {
    const { service, repo } = setup();
    const first = await service.createTeacherInvite(actor('staff'), invitee);
    const again = await service.resendInvite(actor('admin'), first.invite.id);

    expect(again.token).not.toBe(first.token);
    expect(await service.previewInvite(ann, first.token)).toBeNull();
    expect(await service.previewInvite(ann, again.token)).toMatchObject({ kind: 'ready' });
    expect(repo.audit.map(a => a.action)).toEqual(['member.invite', 'member.invite_resend']);
    expect(JSON.stringify(repo.audit)).not.toContain(again.token);
  });

  it('is refused for a teacher, and for an invite already used', async () => {
    const { service } = setup();
    const issued = await service.createTeacherInvite(actor('staff'), invitee);

    expect((await refusalOf(service.resendInvite(actor('teacher'), issued.invite.id))).status).toBe(403);
    await service.acceptInvite(ann, issued.token, profile);
    expect((await refusalOf(service.resendInvite(actor('owner'), issued.invite.id))).status).toBe(404);
  });
});
