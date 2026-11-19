import type { CustomField, RegistrationRow } from '@buxa/contracts';
import { STANDARD_FIELDS } from '@buxa/contracts';
import { fmt, isoDay } from '@buxa/shared';

/*
 * The registrations for each session of a form, one table per session. A row's answers sit behind a disclosure, so the table stays
 * to the four things staff look up: who, the guardian's phone, when, and which form version they answered.
 */

const STANDARD_LABEL = Object.fromEntries(STANDARD_FIELDS.map(f => [f.key, f.label]));

function answerRows(row: RegistrationRow, fields: readonly CustomField[]): { label: string; value: string }[] {
  const standard = Object.entries(row.standard)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    .map(([key, value]) => ({ label: STANDARD_LABEL[key] ?? key, value }));
  // An answer keeps the question it was given under, even if the form has changed since (the key is the fallback label).
  const custom = Object.entries(row.custom).flatMap(([key, value]) => {
    if (value === undefined) {
      return [];
    }
    const shown = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value;

    return [{ label: fields.find(f => f.key === key)?.label ?? key, value: shown }];
  });

  return [...standard, ...custom];
}

export function SubmissionsBySession({
  sessions,
  fields,
  submissions,
}: {
  sessions: readonly { id: string; name: string }[];
  fields: readonly CustomField[];
  submissions: readonly RegistrationRow[];
}) {
  if (sessions.length === 0) {
    return <p className="muted">This form covers no sessions.</p>;
  }

  return (
    <div className="registration-sessions">
      {sessions.map(session => {
        const rows = submissions.filter(row => row.sessions.some(s => s.sessionId === session.id));

        return (
          <section key={session.id} className="registration-session" aria-labelledby={`session-${session.id}`}>
            <h3 id={`session-${session.id}`} className="registration-session__title">
              {session.name} <span className="muted">{rows.length}</span>
            </h3>
            {rows.length === 0 ? (
              <p className="muted">No registrations for this session yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <caption className="sr-only">Registrations for {session.name}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Camper</th>
                      <th scope="col">Guardian phone</th>
                      <th scope="col">Submitted</th>
                      <th scope="col">Answers</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row => (
                      <tr key={row.id}>
                        <td>
                          {row.standard.camperFirstName} {row.standard.camperLastName}
                        </td>
                        <td>{row.standard.guardianPhone}</td>
                        <td>{fmt(isoDay(row.submittedAt), true)}</td>
                        <td>
                          <details>
                            <summary>Answers, version {row.formVersion}</summary>
                            <dl className="registration-answers">
                              {answerRows(row, fields).map(item => (
                                <div key={item.label}>
                                  <dt className="muted">{item.label}</dt>
                                  <dd>{item.value}</dd>
                                </div>
                              ))}
                            </dl>
                          </details>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
