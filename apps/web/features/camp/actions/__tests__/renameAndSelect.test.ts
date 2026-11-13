import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ROUTES } from '@/config';
import { idle } from '@/lib/actions/state';
import { renameCampAction } from '../renameCampAction';
import { selectCampAction } from '../selectCampAction';
import { formOf, startWorld } from './support';

const mocks = vi.hoisted(() => ({ requireSession: vi.fn(), rememberCamp: vi.fn(), revalidatePath: vi.fn() }));
vi.mock('@/server/session', async importOriginal => ({ ...(await importOriginal<object>()), requireSession: mocks.requireSession, rememberCamp: mocks.rememberCamp }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));

describe('renameCampAction and selectCampAction', () => {
  let world: ReturnType<typeof startWorld>;
  let owner: string; let viewer: string; let outsider: string; let orgId: string; let otherOrgId: string;
  const signInAs = (userId: string) => mocks.requireSession.mockImplementation(() => world.sessionOf(userId));

  beforeEach(async () => {
    vi.clearAllMocks();
    world = startWorld();
    [owner, viewer, outsider] = [await world.person(), await world.person(), await world.person()];
    orgId = (await world.store.createWithOwner({ name: 'Sunrise Lake', slug: 'sunrise-lake' }, owner)).id;
    otherOrgId = (await world.store.createWithOwner({ name: 'Other Camp', slug: 'other-camp' }, outsider)).id;
    world.addMember(orgId, viewer, 'viewer');
  });
  afterEach(() => world.stop());

  describe('renameCampAction', () => {
    it('renames the camp for an owner and refreshes the camp area', async () => {
      signInAs(owner);
      const state = await renameCampAction(idle, formOf({ campId: orgId, name: '  Moonrise Lake ' }));
      expect(state).toEqual({ status: 'success', message: 'Camp renamed' });
      expect(world.store.orgs.get(orgId)?.name).toBe('Moonrise Lake');
      expect(mocks.revalidatePath).toHaveBeenCalledWith(ROUTES.camp, 'layout');
    });

    it('reports an invalid name on the name field', async () => {
      signInAs(owner);
      const state = await renameCampAction(idle, formOf({ campId: orgId, name: '   ' }));
      expect(state).toMatchObject({ status: 'error', fieldErrors: { name: 'Give your camp a name.' } });
      expect(world.store.orgs.get(orgId)?.name).toBe('Sunrise Lake');
    });

    it('answers a role that may not rename with an error, not an exception', async () => {
      signInAs(viewer);
      const state = await renameCampAction(idle, formOf({ campId: orgId, name: 'Hijacked' }));
      expect(state).toEqual({ status: 'error', message: 'Your role cannot do this.', fieldErrors: undefined });
      expect(world.store.orgs.get(orgId)?.name).toBe('Sunrise Lake');
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it('refuses a camp id the person does not belong to, whatever the form says', async () => {
      signInAs(owner);
      const state = await renameCampAction(idle, formOf({ campId: otherOrgId, name: 'Hijacked' }));
      expect(state).toMatchObject({ status: 'error', message: 'You are not a member of that camp.' });
      expect(world.store.orgs.get(otherOrgId)?.name).toBe('Other Camp');
      const missing = await renameCampAction(idle, new FormData());
      expect(missing.status).toBe('error');
    });
  });

  describe('selectCampAction', () => {
    it('remembers a camp the person belongs to and refreshes the camp area', async () => {
      signInAs(viewer);
      await selectCampAction(orgId);
      expect(mocks.rememberCamp).toHaveBeenCalledWith(orgId);
      expect(mocks.revalidatePath).toHaveBeenCalledWith(ROUTES.camp, 'layout');
    });

    it('ignores a camp the person does not belong to', async () => {
      signInAs(viewer);
      await expect(selectCampAction(otherOrgId)).resolves.toBeUndefined();
      expect(mocks.rememberCamp).not.toHaveBeenCalled();
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });
  });
});
