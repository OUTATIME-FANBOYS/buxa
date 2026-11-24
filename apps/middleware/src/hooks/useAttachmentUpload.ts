'use client';

import { useRef, useState } from 'react';
import { useStore } from '../providers/providers';
import { useUi } from '../providers/UiProvider';
import { ATTACHMENT_MAX_BYTES as MAX_FILE } from '@buxa/shared/files/attachmentTypes';

const readAsDataUrl = (f: File) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => {
      if (typeof r.result === 'string') {
        res(r.result);
      } else {
        rej(new Error('read failed'));
      }
    };
    r.onerror = () => rej(new Error('read failed'));
    r.readAsDataURL(f);
  });

/** Reads chosen files into the task (kept in this browser; 1 MB each). Reports files that are too big or unreadable. */
export function useAttachmentUpload(taskId: string) {
  const { actions } = useStore();
  const { toast } = useUi();
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const upload = async (files: FileList | null) => {
    if (!files?.length) {
      return;
    }
    setBusy(true);
    for (const f of Array.from(files)) {
      if (f.size > MAX_FILE) {
        toast(`“${f.name}” is over 1 MB. Link to it in a comment instead.`, { tone: 'error' });
        continue;
      }
      const dataUrl = await readAsDataUrl(f).catch(() => '');
      if (!dataUrl) {
        toast(`Couldn’t read “${f.name}”.`, { tone: 'error' });
        continue;
      }
      actions.addAttachment(taskId, { name: f.name, size: f.size, type: f.type, dataUrl });
    }
    setBusy(false);
    if (input.current) {
      input.current.value = '';
    }
  };

  return { busy, input, upload };
}
