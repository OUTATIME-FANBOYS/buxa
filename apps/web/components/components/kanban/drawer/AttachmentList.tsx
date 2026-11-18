import type { Task } from '@buxa/shared';
import { useStore } from '@buxa/middleware/providers/providers';
import { Icon, Button } from '@/components/elements/export';
import { fmtSize } from '@buxa/shared';
import { useAttachmentUpload } from '@buxa/middleware/hooks/hooks';

export function AttachmentList({ task, ro }: { task: Task; ro: boolean }) {
  const { actions } = useStore();
  const { busy, input, upload } = useAttachmentUpload(task.id);

  return (
    <section className="section">
      <div className="section-head">
        <h3>Attachments</h3>
        {!ro && (
          <>
            <input ref={input} type="file" multiple hidden onChange={e => void upload(e.target.files)} />
            <Button size="sm" disabled={busy} onClick={() => input.current?.click()}>
              <Icon name="clip" size={14} />
              {busy ? 'Uploading…' : 'Attach'}
            </Button>
          </>
        )}
      </div>
      {task.attachments.length === 0 && (
        <p className="muted small">No files yet. Files up to 1 MB are stored in this browser.</p>
      )}
      <ul className="files">
        {task.attachments.map(a => (
          <li key={a.id}>
            <Icon name="clip" size={15} />
            <span className="file-name">{a.name}</span>
            <span className="muted small">{fmtSize(a.size)}</span>
            {a.dataUrl && (
              <Button iconOnly icon="download" href={a.dataUrl} download={a.name} aria-label={`Download ${a.name}`} />
            )}
            {!ro && (
              <Button
                iconOnly
                icon="x"
                aria-label={`Remove ${a.name}`}
                onClick={() => actions.removeAttachment(task.id, a.id)}
              />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
