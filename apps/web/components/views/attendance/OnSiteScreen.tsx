import { notFound } from 'next/navigation';
import { authorize } from '@buxa/domain';
import { Empty } from '@/components/components';
import { PageHeader } from '@/components/components';
import { loadOnSiteEntries } from '@buxa/server/composers/index.server';
import { OnSiteList } from '@/components/components/attendance';
import { campActor, campClock } from '@buxa/server/composers/index.server';
import { onSiteSummary, toOnSiteRow } from '@buxa/shared';

/** Everyone on site now, oldest arrival first, with check-out for staff. */
export async function OnSiteScreen() {
  const actor = await campActor();
  if (!actor) {
    notFound();
  }
  if (!authorize(actor, 'attendance:read').allow) {
    return (
      <div className="page">
        <PageHeader title="On site" />
        <Empty icon="users" title="You cannot see who is on site" body="Ask a staff member." />
      </div>
    );
  }
  const [entries, { timeZone, clockFormat }] = await Promise.all([loadOnSiteEntries(actor), campClock(actor)]);
  const rows = entries.map(entry => toOnSiteRow(entry, timeZone, clockFormat));
  const canRecord = authorize(actor, 'attendance:record').allow;
  const canOverride = authorize(actor, 'attendance:override').allow;

  if (rows.length === 0) {
    return (
      <div className="page">
        <PageHeader title="On site" subtitle={onSiteSummary(rows.length)} />
        <Empty icon="clock" title="No one is on site" body="People appear here when they are checked in." />
      </div>
    );
  }

  return (
    <div className="page">
      <OnSiteList
        title="On site"
        subtitle={onSiteSummary(rows.length)}
        rows={rows}
        canRecord={canRecord}
        canOverride={canOverride}
      />
    </div>
  );
}
