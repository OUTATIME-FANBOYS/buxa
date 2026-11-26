import type { RegistrationForm } from '@buxa/contracts';
import { fmtSize } from '@buxa/shared';
import { Dialog } from '@/components/components/Dialog';
import { Button, Pill } from '@/components/elements';
import { registrationFormFilePath } from '@/config/routes';
import { KIND_LABEL } from './QuestionBuilder';

export interface FormViewDialogProps {
  form: RegistrationForm;
  /** Shows Edit form, for staff with registration:manage. */
  canEdit: boolean;
  /** Shows a download for each file, for staff who may take a registration (the file route checks it too). */
  canSubmit: boolean;
  onEdit: () => void;
  onClose: () => void;
}

/**
 * A registration form, read only, in a pop-up: its name, the sessions it covers, the camp's own questions (name, type,
 * required or optional, options) and the files families download (name and size). Nothing here is a field, so nothing can be changed
 * from it; Edit form opens the edit pop-up for those who can. The sections share the edit form's rhythm (a heading, a muted line, the
 * content), and the lists are plain rows with a thin divider, not boxes that look like inputs.
 */
export function FormViewDialog({ form, canEdit, canSubmit, onEdit, onClose }: FormViewDialogProps) {
  // This pop-up shows the published version, the one families register on. A form never published shows a note instead.
  const published = form.published;
  // A file downloads for one session the published version covers, so the first one stands in for the form.
  const downloadSession = published?.sessions[0];

  return (
    <Dialog
      title={published?.name ?? form.name}
      onClose={onClose}
      className="class-dialog"
      footer={
        <>
          <Button variant="glass" onClick={onClose}>
            Close
          </Button>
          {canEdit && (
            <Button variant="primary" icon="edit" onClick={onEdit}>
              Edit form
            </Button>
          )}
        </>
      }
    >
      <div className="form-view">
        <div className="form-section">
          <p>
            {published === null ? (
              <Pill tone="neutral">Draft</Pill>
            ) : (
              <Pill tone="ok">Published V{published.version}</Pill>
            )}
          </p>
          {published === null && (
            <p className="muted">Not published yet. Families cannot register on this form until it is published.</p>
          )}
        </div>

        <section className="form-section" aria-labelledby="form-view-sessions">
          <h3 id="form-view-sessions" className="form-section__title">
            Sessions this form covers
          </h3>
          {published === null ? null : published.sessions.length === 0 ? (
            <p className="muted">No sessions yet.</p>
          ) : (
            <ul className="session-picker__tags">
              {published.sessions.map(session => (
                <li key={session.id}>
                  <span className="session-tag session-tag--static">{session.name}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="form-section" aria-labelledby="form-view-questions">
          <h3 id="form-view-questions" className="form-section__title">
            Your questions
          </h3>
          <p className="muted">The standard questions about the camper and family are always asked.</p>
          {published === null ? null : published.fields.length === 0 ? (
            <p className="muted">This form asks no questions of its own.</p>
          ) : (
            <ul className="form-view__list">
              {published.fields.map(field => (
                <li key={field.key} className="form-view__row">
                  <span className="form-view__name">{field.label}</span>
                  <span className="muted">{`${KIND_LABEL[field.kind]} · ${field.required ? 'Required' : 'Optional'}`}</span>
                  {field.kind === 'choice' && <span className="muted">{`Options: ${field.options.join(', ')}`}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="form-section" aria-labelledby="form-view-files">
          <h3 id="form-view-files" className="form-section__title">
            Files for families
          </h3>
          <p className="muted">Forms families can download with the registration, such as a blank immunization form.</p>
          {form.attachments.length === 0 ? (
            <p className="muted">No files yet.</p>
          ) : (
            <ul className="form-view__list">
              {form.attachments.map(file => (
                <li key={file.id} className="form-view__row form-view__row--file">
                  <span className="form-view__name">{file.name}</span>
                  <span className="form-view__meta">
                    <span className="muted">{fmtSize(file.sizeBytes)}</span>
                    {canSubmit && downloadSession && (
                      <Button
                        variant="ghost"
                        size="sm"
                        href={registrationFormFilePath(file.id, downloadSession.id)}
                        download
                        aria-label={`Download ${file.name}`}
                      >
                        Download
                      </Button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Dialog>
  );
}
