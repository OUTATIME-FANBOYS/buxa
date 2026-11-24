import type { CustomField, RegistrationClass, RegistrationRow } from '@buxa/contracts';
import { STANDARD_FIELDS } from '@buxa/contracts';
import { formatMoney } from '@buxa/domain';
import { fmt, isoDay } from '@buxa/shared';
import { Pill } from '@/components/elements';
import { ConfirmRegistration } from './ConfirmRegistration';
import { RecordPayment } from './RecordPayment';

/*
 * The registrations for each session of a form, one table per session. A row's answers sit behind a disclosure, so the table stays
 * to the things staff look up: who, the guardian's phone, when, its status, its places and which form version they answered.
 * A pending registration has one action, Confirm (decision 3). A confirmed one has no action. Each child's place in a class shows
 * its status (held, waitlisted, enrolled, expired, cancelled) and its payment, which staff record by hand.
 */

const PLACE_STATUS: Record<RegistrationClass['status'], { label: string; tone: 'ok' | 'warn' | 'neutral' | 'crit' }> = {
  held: { label: 'Held', tone: 'warn' },
  waitlisted: { label: 'Waitlisted', tone: 'neutral' },
  enrolled: { label: 'Enrolled', tone: 'ok' },
  expired: { label: 'Hold expired', tone: 'crit' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};

function PlaceList({ formId, places }: { formId: string; places: readonly RegistrationClass[] }) {
  if (places.length === 0) {
    return <span className="muted">No places chosen.</span>;
  }

  return (
    <ul className="registration-places">
      {places.map(place => {
        const status = PLACE_STATUS[place.status];
        const paid = place.paymentStatus === 'paid';

        return (
          <li key={place.id}>
            <span>
              {place.camperName}, {place.className}
            </span>{' '}
            <Pill tone={status.tone}>{status.label}</Pill>{' '}
            {place.price ? (
              <span className="muted">
                {formatMoney(place.price.amountMinor, place.price.currency)}
                {place.price.earlyBird ? ' early bird' : ''}
              </span>
            ) : null}{' '}
            <Pill tone={paid ? 'ok' : 'neutral'}>{paid ? 'Paid' : 'Unpaid'}</Pill>
            {paid && place.paymentNote ? <span className="muted"> {place.paymentNote}</span> : null}
            {place.status === 'cancelled' ? null : (
              <RecordPayment formId={formId} registrationClassId={place.id} paid={paid} />
            )}
          </li>
        );
      })}
    </ul>
  );
}

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
  formId,
  sessions,
  fields,
  submissions,
}: {
  formId: string;
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
        const placesOf = (row: RegistrationRow) => row.classes.filter(c => c.sessionId === session.id);

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
                      <th scope="col">Status</th>
                      <th scope="col">Places</th>
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
                          {row.status === 'confirmed' ? (
                            <Pill tone="ok">Confirmed</Pill>
                          ) : (
                            <>
                              <Pill tone="warn">Pending</Pill>
                              <ConfirmRegistration formId={formId} registrationId={row.id} />
                            </>
                          )}
                        </td>
                        <td>
                          <PlaceList formId={formId} places={placesOf(row)} />
                        </td>
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
