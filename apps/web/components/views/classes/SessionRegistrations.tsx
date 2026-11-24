import type { Actor } from '@buxa/domain';
import { FORBIDDEN_REGISTRATION } from '@buxa/shared';
import { loadFormSubmissions } from '@buxa/server/composers/index.server';
import { Empty } from '@/components/components';
import { SubmissionsBySession } from '@/components/components/registration';

/**
 * The Registrations tab of a session: every registration that asks for this session, grouped by the form it was made on. The rows
 * are the same ones the form page shows, so the actions (confirm, record payment) are the same too. Needs registration:read.
 */
export async function SessionRegistrations({
  actor,
  sessionId,
  sessionName,
}: {
  actor: Actor;
  sessionId: string;
  sessionName: string;
}) {
  const loaded = await loadFormSubmissions(actor, sessionId);
  if (!loaded.ok) {
    return <Empty icon="alert" title="You cannot see registrations" body={FORBIDDEN_REGISTRATION} />;
  }
  if (loaded.value.length === 0) {
    return (
      <Empty
        icon="list"
        title="No registrations for this session yet"
        body="Registrations appear here once a registration form that covers this session has been published and taken."
      />
    );
  }

  return (
    <div className="stack">
      {loaded.value.map(({ form, rows }) => (
        <section key={form.id} className="registration-section" aria-labelledby={`session-form-${form.id}`}>
          <h2 id={`session-form-${form.id}`} className="people-subheading">
            {form.name}
          </h2>
          <SubmissionsBySession
            formId={form.id}
            sessions={[{ id: sessionId, name: sessionName }]}
            fields={form.fields}
            submissions={rows}
          />
        </section>
      ))}
    </div>
  );
}
