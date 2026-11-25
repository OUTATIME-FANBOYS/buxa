import Link from 'next/link';
import type { RegistrationForm } from '@buxa/contracts';
import { Pill } from '@/components/elements';
import { registrationFormPath } from '@/config/routes';
import { FormRowActions } from './FormRowActions';

/**
 * The camp's registration forms: name and season, the sessions they cover, whether they are published, how many registrations, and
 * three icon buttons at the right end (View, Edit and Delete). The name opens the form's page, which lists its registrations.
 */
export function FormsTable({
  forms,
  sessions,
  canEdit,
  canSubmit,
}: {
  forms: readonly RegistrationForm[];
  /** The camp's sessions, for the edit pop-up's session picker. */
  sessions: readonly { id: string; name: string }[];
  /** Whether the viewer may open the edit pop-up (registration:manage and the session list read). */
  canEdit: boolean;
  /** Whether the viewer may take registrations, which decides who sees the file downloads. */
  canSubmit: boolean;
}) {
  return (
    <div className="table-wrap">
      <table className="table">
        <caption className="sr-only">Registration forms in the camp</caption>
        <thead>
          <tr>
            <th scope="col">Form</th>
            <th scope="col">Sessions</th>
            <th scope="col">Status</th>
            <th scope="col">Registrations</th>
            <th scope="col">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {forms.map(form => (
            <tr key={form.id}>
              <td>
                <Link className="row-title classes-target" href={registrationFormPath(form.id)}>
                  {form.name}
                </Link>
                {form.season && <span className="muted"> · {form.season}</span>}
              </td>
              <td>{form.sessions.length}</td>
              <td>
                {form.publishedVersion === null ? (
                  <Pill tone="neutral">Draft</Pill>
                ) : (
                  <Pill tone="ok">Published, version {form.publishedVersion}</Pill>
                )}
              </td>
              <td>{form.submissionCount}</td>
              <td>
                <FormRowActions form={form} sessions={sessions} canEdit={canEdit} canSubmit={canSubmit} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
