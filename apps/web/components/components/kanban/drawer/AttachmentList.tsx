import type { Task } from '@buxa/shared';
import { useStore } from '@buxa/middleware/providers/providers';
import { Icon, Button } from '@/components/elements';
import { FileField } from '@/components/atoms';
import { fmtSize } from '@buxa/shared';
import { useAttachmentUpload } from '@buxa/middleware/hooks/hooks';

export function AttachmentList({ task, ro }: { task: Task; ro: boolean }) {
  const { actions } = useStore();
  const { busy, input, upload } = useAttachmentUpload(task.id);

  return (
    <section className="section buxa:grid buxa:gap-[var(--s3)]">
      <div className="section-head buxa:flex buxa:justify-between buxa:items-center">
        <h3>Attachments</h3>
        {!ro && (
          <>
            <FileField inputRef={input} multiple onChange={files => void upload(files)} />
            <Button size="sm" icon="clip" disabled={busy} onClick={() => input.current?.click()}>
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
          <li
            key={a.id}
            className="buxa:flex buxa:items-center buxa:gap-[var(--s3)] buxa:[padding:6px_0] buxa:text-[var(--text-2)]"
          >
            <Icon name="clip" size={15} />
            <span className="file-name buxa:flex-1 buxa:text-[var(--text)] buxa:overflow-hidden buxa:text-ellipsis buxa:whitespace-nowrap">
              {a.name}
            </span>
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
