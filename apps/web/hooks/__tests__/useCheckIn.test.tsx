// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { PersonCard } from '@/logic/common';
import { useCheckIn } from '../useCheckIn';

const h = vi.hoisted(() => ({ checkInAction: vi.fn(), scanCodeAction: vi.fn() }));
vi.mock('@/logic/composers/attendance/checkIn', () => ({ checkInAction: h.checkInAction }));
vi.mock('@/logic/composers/attendance/scanCode', () => ({ scanCodeAction: h.scanCodeAction }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Api = ReturnType<typeof useCheckIn>;
let api: Api | undefined;
function Probe() { api = useCheckIn(); return null; }

const card = { person: { id: 'p-1', givenName: 'Ada', familyName: 'Lee', preferredName: null, status: 'valid' }, onSiteSince: null } as unknown as PersonCard;

describe('useCheckIn', () => {
  let root: Root;
  beforeEach(() => {
    vi.clearAllMocks();
    api = undefined;
    root = createRoot(document.body.appendChild(document.createElement('div')));
    act(() => root.render(<Probe />));
  });
  afterEach(() => { act(() => root.unmount()); document.body.innerHTML = ''; });

  it('starts idle', () => {
    expect(api!.state.phase).toBe('idle');
  });
  it('moves to a ready person when a name is picked, by search', () => {
    act(() => api!.pickPerson(card));
    expect(api!.state).toMatchObject({ phase: 'ready', method: 'search' });
  });
  it('checks the person in with the validated input and records the answer', async () => {
    h.checkInAction.mockResolvedValueOnce({ kind: 'forbidden', message: 'No.' });
    act(() => api!.pickPerson(card));
    await act(async () => { await api!.checkIn(card, 'search'); });
    expect(h.checkInAction).toHaveBeenCalledWith({ personId: 'p-1', method: 'search' });
    expect(api!.state.phase).toBe('failed');
  });
  it('passes an override reason through when given', async () => {
    h.checkInAction.mockResolvedValueOnce({ kind: 'forbidden', message: 'No.' });
    await act(async () => { await api!.checkIn(card, 'qr', 'Early pickup agreed'); });
    expect(h.checkInAction).toHaveBeenCalledWith({ personId: 'p-1', method: 'qr', overrideReason: 'Early pickup agreed' });
  });
  it('clears back to idle', async () => {
    act(() => api!.pickPerson(card));
    act(() => api!.clear());
    expect(api!.state.phase).toBe('idle');
  });
});
