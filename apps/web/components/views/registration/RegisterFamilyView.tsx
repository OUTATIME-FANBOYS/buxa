import { notFound } from 'next/navigation';
import { FORBIDDEN_REGISTRATION } from '@buxa/shared';
import { campClock, currentActor, loadRegisterPage } from '@buxa/server/composers/index.server';
import { registrationFormPath } from '@/config/routes';
import { Empty, PageHeader } from '@/components/components';
import { RegisterForm } from '@/components/components/registration';
import { Button } from '@/components/elements';

/** The page where staff take a registration for a family. It asks the published version's questions, so a draft never leaks in. */
export async function RegisterFamilyView({ formId }: { formId: string }) {
  const actor = await currentActor();
  if (!actor) {
    notFound();
  }
  const loaded = await loadRegisterPage(actor, formId);
  if (!loaded.ok) {
    if (loaded.reason === 'not-found') {
      notFound();
    }

    return (
      <div className="page">
        <Empty icon="alert" title="You cannot take registrations" body={FORBIDDEN_REGISTRATION} />
      </div>
    );
  }
  const { form, published, sessions, campers } = loaded.value;
  const clock = await campClock(actor);

  if (!published) {
    return (
      <div className="page">
        <PageHeader title="Take a registration" subtitle={form.name} />
        <Empty
          icon="list"
          title="Publish this form first"
          body="A form takes registrations once it is published. Publish it from the form's page."
          action={
            <Button variant="secondary" href={registrationFormPath(form.id)}>
              Back to the form
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        title="Take a registration"
        subtitle={`${published.name}, version ${published.version}. Choose the children, then their classes.`}
      />
      <RegisterForm
        formId={form.id}
        sessions={sessions}
        campers={campers}
        timeZone={clock.timeZone}
        clockFormat={clock.clockFormat}
        fields={published.fields}
        attachments={form.attachments}
      />
    </div>
  );
}
