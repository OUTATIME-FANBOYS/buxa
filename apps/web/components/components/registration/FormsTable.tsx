import Link from 'next/link';
import type { RegistrationForm } from '@buxa/contracts';
import { Pill } from '@/components/elements';
import { registrationFormPath } from '@/config/routes';

/** The camp's registration forms: name and season, the sessions they cover, whether they are published, and how many registrations. */
export function FormsTable({ forms }: { forms: readonly RegistrationForm[] }) {
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
