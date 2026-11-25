import { notFound } from 'next/navigation';
import { can } from '@buxa/domain';
import { FORBIDDEN_REGISTRATION } from '@buxa/shared';
import {
  campClock,
  currentActor,
  loadFormPage,
  loadRegisterPage,
  loadSessions,
} from '@buxa/server/composers/index.server';
import { Empty, PageHeader } from '@/components/components';
import { EditFormButton, SubmissionsBySession, TakeRegistrationButton } from '@/components/components/registration';
import { Pill } from '@/components/elements';

/**
 * One registration form's page. It is the form's registrations, grouped by session: the questions are edited in the Edit form
 * pop-up (registration:manage), not on the page. Staff who may record registrations get Take a registration once the form is
 * published.
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
  // The edit pop-up needs every session in the camp to offer, so it is shown only when the session list can be read.
  const sessions = canManage ? await loadSessions(actor) : null;
  const editForm =
    sessions?.ok === true ? (
      <EditFormButton form={form} sessions={sessions.value.map(s => ({ id: s.id, name: s.name }))} />
    ) : undefined;
  const actions =
    takeRegistration || editForm ? (
      <>
        {editForm}
        {takeRegistration}
      </>
    ) : undefined;

  return (
    <div className="page">
      <PageHeader
        title={form.published?.name ?? form.name}
        subtitle={form.published?.season ?? form.season ?? 'Registration form'}
        actions={actions}
      />
      <p>
        {published ? (
          <Pill tone="ok">Published version {form.publishedVersion}</Pill>
        ) : (
          <Pill tone="neutral">Draft. Publish it before taking registrations.</Pill>
        )}
        {form.hasUnpublishedChanges && <Pill tone="warn">Unpublished changes</Pill>}
      </p>

      <section className="registration-section" aria-labelledby="registration-submissions-heading">
        <h2 id="registration-submissions-heading">Registrations</h2>
        <SubmissionsBySession
          formId={form.id}
          sessions={form.published?.sessions ?? []}
          fields={form.fields}
          submissions={submissions}
          canDelete={can(actor, 'registration:delete')}
        />
      </section>
    </div>
  );
}
