import { notFound } from 'next/navigation';
import { can } from '@buxa/domain';
import { FORBIDDEN_REGISTRATION } from '@buxa/shared';
import { currentActor, loadFormPage } from '@buxa/server/composers/index.server';
import { registrationRegisterPath } from '@/config/routes';
import { Empty, PageHeader } from '@/components/components';
import { FormEditor, PublishButton, SubmissionsBySession } from '@/components/components/registration';
import { Button, Pill } from '@/components/elements';

/**
 * One registration form: its draft (for managers), its publish step, and its registrations grouped by session. Staff who may
 * record registrations get the Take a registration button once the form is published.
 */
export async function RegistrationFormView({ formId }: { formId: string }) {
  const actor = await currentActor();
  if (!actor) {
    notFound();
  }
  const canManage = can(actor, 'registration:manage');
  const canSubmit = can(actor, 'registration:submit');
  const loaded = await loadFormPage(actor, formId);
  if (!loaded.ok) {
    if (loaded.reason === 'not-found') {
      notFound();
    }

    return (
      <div className="page">
        <Empty icon="alert" title="You cannot see this form" body={FORBIDDEN_REGISTRATION} />
      </div>
    );
  }
  const { form, submissions } = loaded.value;
  const published = form.publishedVersion !== null;

  const actions =
    canSubmit && published ? (
      <Button variant="secondary" icon="plus" href={registrationRegisterPath(form.id)}>
        Take a registration
      </Button>
    ) : undefined;

  return (
    <div className="page">
      <PageHeader title={form.name} subtitle={form.season ?? 'Registration form'} actions={actions} />
      <p>
        {published ? (
          <Pill tone="ok">Published, version {form.publishedVersion}</Pill>
        ) : (
          <Pill tone="neutral">Draft. Publish it before taking registrations.</Pill>
        )}
      </p>

      {canManage && (
        <section className="registration-section" aria-labelledby="registration-form-heading">
          <h2 id="registration-form-heading">Form</h2>
          <FormEditor
            mode="edit"
            formId={form.id}
            sessions={form.sessions}
            initial={{
              name: form.name,
              season: form.season,
              sessionIds: form.sessions.map(s => s.id),
              fields: form.fields,
            }}
          />
          <PublishButton formId={form.id} publishedVersion={form.publishedVersion} />
        </section>
      )}

      <section className="registration-section" aria-labelledby="registration-submissions-heading">
        <h2 id="registration-submissions-heading">Registrations</h2>
        <SubmissionsBySession
          formId={form.id}
          sessions={form.sessions}
          fields={form.fields}
          submissions={submissions}
        />
      </section>
    </div>
  );
}
