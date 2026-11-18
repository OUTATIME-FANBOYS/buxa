import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  archiveCamp: vi.fn(),
  deleteCamp: vi.fn(),
  listArchivedCamps: vi.fn(),
}));

vi.mock('@buxa/server/composers/camp/archiveCamp', () => ({ archiveCamp: h.archiveCamp }));
vi.mock('@buxa/server/composers/camp/deleteCamp', () => ({ deleteCamp: h.deleteCamp }));
vi.mock('@buxa/server/composers/camp/listArchivedCamps', () => ({ listArchivedCamps: h.listArchivedCamps }));

import { archiveCamp, deleteCamp, listArchivedCamps } from '../camp';

const ORG_ID = '6f1c2b1e-0d7a-4c3e-9a55-2f8e1b7d4c10';

describe('camp archive and delete actions', () => {
  beforeEach(() => {
    h.archiveCamp.mockReset();
    h.deleteCamp.mockReset();
    h.listArchivedCamps.mockReset();
  });

  it('archiveCamp calls the server composer with the camp id and returns its result', async () => {
    h.archiveCamp.mockResolvedValue({ ok: true });

    await expect(archiveCamp({ orgId: ORG_ID })).resolves.toEqual({ ok: true });
    expect(h.archiveCamp).toHaveBeenCalledWith({ orgId: ORG_ID });
  });

  it('archiveCamp passes the server refusal message through', async () => {
    h.archiveCamp.mockResolvedValue({ ok: false, message: 'Only the owner can archive this camp.' });

    await expect(archiveCamp({ orgId: ORG_ID })).resolves.toEqual({ ok: false, message: 'Only the owner can archive this camp.' });
  });

  it('deleteCamp calls the server composer with the camp id and the typed name, and returns its result', async () => {
    h.deleteCamp.mockResolvedValue({ ok: true });

    await expect(deleteCamp({ orgId: ORG_ID, confirmName: 'Summer Camp' })).resolves.toEqual({ ok: true });
    expect(h.deleteCamp).toHaveBeenCalledWith({ orgId: ORG_ID, confirmName: 'Summer Camp' });
  });

  it('deleteCamp passes a name mismatch refusal through unchanged', async () => {
    h.deleteCamp.mockResolvedValue({ ok: false, message: 'Type the camp name exactly to delete it.' });

    await expect(deleteCamp({ orgId: ORG_ID, confirmName: 'summer camp' })).resolves.toEqual({
      ok: false,
      message: 'Type the camp name exactly to delete it.',
    });
  });

  it('listArchivedCamps returns the server composer result, with archivedAt as an ISO string', async () => {
    const camps = [{ id: ORG_ID, name: 'Summer Camp', archivedAt: '2026-10-01T09:30:00.000Z' }];
    h.listArchivedCamps.mockResolvedValue(camps);

    await expect(listArchivedCamps()).resolves.toEqual(camps);
    expect(h.listArchivedCamps).toHaveBeenCalledWith();
  });
});
