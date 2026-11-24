import { notFound } from 'next/navigation';
import { can } from '@buxa/domain';
import { FORBIDDEN_REGISTRATION } from '@buxa/shared';
import { campClock, currentActor, loadFormPage, loadRegisterPage } from '@buxa/server/composers/index.server';
import { Empty, PageHeader } from '@/components/components';
import {
  FormEditor,
  PublishButton,
  SubmissionsBySession,
  TakeRegistrationButton,
} from '@/components/components/registration';
import { Pill } from '@/components/elements';

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

  // A family's answers are asked from the published version only, so the dialog takes that version's questions.
  const register = canSubmit && published ? await loadRegisterPage(actor, form.id) : null;
  const clock = register?.ok && register.value.published ? await campClock(actor) : null;
  const takeRegistration =
    register?.ok && register.value.published && clock ? (
      <TakeRegistrationButton
        formId={form.id}
        sessions={register.value.sessions}
        campers={register.value.campers}
        timeZone={clock.timeZone}
        clockFormat={clock.clockFormat}
        fields={register.value.published.fields}
        attachments={register.value.form.attachments}
      />
    ) : undefined;
  const actions = takeRegistration;

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
              attachments: form.attachments,
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
          canDelete={can(actor, 'registration:delete')}
        />
      </section>
    </div>
  );
}
