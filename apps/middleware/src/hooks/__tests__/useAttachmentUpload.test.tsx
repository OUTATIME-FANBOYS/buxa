import { StubDialog } from '../../providers/__tests__/stubDialog';
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { UiProvider } from '../../providers/UiProvider';
import { useAttachmentUpload } from '../useAttachmentUpload';

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- Kept: the compiler needs this assertion to type the value; removing it fails typecheck.
const h = vi.hoisted(() => ({ store: {} as Record<string, unknown> }));
vi.mock('../../providers/store', () => ({ useStore: () => h.store }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Api = ReturnType<typeof useAttachmentUpload>;
let api: Api | undefined;

function Probe() {
  api = useAttachmentUpload('t-1');

  return null;
}

const list = (...files: File[]) => ({ length: files.length, item: (i: number) => files[i], [Symbol.iterator]: function* () {
  yield* files;
} }) as unknown as FileList;

describe('useAttachmentUpload', () => {
  let root: Root;
  beforeEach(() => {
    api = undefined;
    h.store = { actions: { addAttachment: vi.fn() } };
    root = createRoot(document.body.appendChild(document.createElement('div')));
    act(() => root.render(<UiProvider Dialog={StubDialog}><Probe /></UiProvider>));
  });
  afterEach(() => {
    act(() => root.unmount()); document.body.innerHTML = '';
  });

  it('stores a small file on the task with its name, size and type', async () => {
    const file = new File(['hello'], 'note.txt', { type: 'text/plain' });
    await act(async () => {
      await api!.upload(list(file));
    });
    expect((h.store.actions as { addAttachment: ReturnType<typeof vi.fn> }).addAttachment).toHaveBeenCalledWith('t-1', expect.objectContaining({ name: 'note.txt', size: 5, type: 'text/plain' }));
  });
  it('refuses a file over 1 MB and says to link to it instead', async () => {
    const big = new File([new Uint8Array(1024 * 1024 + 1)], 'big.bin');
    await act(async () => {
      await api!.upload(list(big));
    });
    expect((h.store.actions as { addAttachment: ReturnType<typeof vi.fn> }).addAttachment).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('“big.bin” is over 1 MB.');
  });
  it('does nothing when no files were chosen', async () => {
    await act(async () => {
      await api!.upload(null);
    });
    expect(api!.busy).toBe(false);
  });
});
