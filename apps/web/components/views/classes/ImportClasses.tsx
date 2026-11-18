import { notFound } from 'next/navigation';
import { can, IMPORT_COLUMNS, MAX_IMPORT_ROWS } from '@buxa/domain';
import { ROUTES } from '@/config/routes';
import { Empty, PageHeader } from '@/components/components/export';
import { currentActor } from '@buxa/server/composers/index.server';
import { FORBIDDEN_MANAGE } from '@buxa/shared';
import { ImportForm } from '@/components/components/classes/forms/export';
import { Button } from '@/components/elements/export';

/**
 * Bulk import: download the template, fill it in a spreadsheet, upload it, read the preview, then confirm. Viewers get the forbidden
 * state and no template, upload or confirm controls.
 */
export async function ImportClasses() {
  const actor = await currentActor();
  if (!actor) {
    notFound();
  }
  if (!can(actor, 'classes:manage')) {
    return (
      <div className="page">
        <PageHeader title="Import classes" />
        <Empty
          icon="alert"
          title="You cannot import sessions"
          body={FORBIDDEN_MANAGE}
          action={
            <Button className="classes-target" href={ROUTES.classes}>
              Back to classes
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        title="Import classes and sessions"
        subtitle="Create many sessions from a spreadsheet. Every row is checked the same way as a manual entry."
        actions={
          <Button className="classes-target" href={ROUTES.classImportTemplate} download>
            Download the template (CSV)
          </Button>
        }
      />
      <section aria-labelledby="columns-heading" className="panel stack">
        <h2 id="columns-heading" className="people-subheading">
          Columns
        </h2>
        <p className="muted">
          The header row must have these columns. Times are the camp&apos;s clock, for example 2027-07-05T09:00. The
          class must already exist; an import does not create classes. Up to {MAX_IMPORT_ROWS} rows at a time.
        </p>
        <p>
          <code className="classes-columns">{IMPORT_COLUMNS.join(', ')}</code>
        </p>
        <p className="muted">
          Rows with the same external_key update the session they matched. Rows without a key are created once.
        </p>
      </section>
      <ImportForm />
    </div>
  );
}
