import type { Task } from '../../types';
import { useStore } from '../../state/store';
import { Icon } from '@/components/ui';
import { fmtSize } from '../../lib/tasks';
import { useAttachmentUpload } from '../../hooks/useAttachmentUpload';

export function AttachmentList({ task, ro }: { task: Task; ro: boolean }) {
  const { actions } = useStore();
  const { busy, input, upload } = useAttachmentUpload(task.id);
  return (
    <section className="section">
      <div className="section-head"><h3>Attachments</h3>
        {!ro && <><input ref={input} type="file" multiple hidden onChange={e => upload(e.target.files)} /><button className="btn btn-sm" disabled={busy} onClick={() => input.current?.click()}><Icon name="clip" size={14} />{busy ? 'Uploading…' : 'Attach'}</button></>}</div>
      {task.attachments.length === 0 && <p className="muted small">No files yet. Files up to 1 MB are stored in this browser.</p>}
      <ul className="files">
        {task.attachments.map(a => (
          <li key={a.id}><Icon name="clip" size={15} /><span className="file-name">{a.name}</span><span className="muted small">{fmtSize(a.size)}</span>
            {a.dataUrl && <a className="icon-btn" href={a.dataUrl} download={a.name} aria-label={`Download ${a.name}`}><Icon name="download" size={15} /></a>}
            {!ro && <button className="icon-btn" aria-label={`Remove ${a.name}`} onClick={() => actions.removeAttachment(task.id, a.id)}><Icon name="x" size={14} /></button>}</li>
        ))}
      </ul>
    </section>
  );
}
