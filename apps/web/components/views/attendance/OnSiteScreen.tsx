import { notFound } from 'next/navigation';
import { authorize } from '@buxa/domain';
import { Empty } from '@/components/components/export';
import { PageHeader } from '@/components/components/export';
import { loadOnSiteEntries } from '@buxa/server/composers/index.server';
import { ON_SITE_LIST_ID, OnSiteRow } from '@/components/components/attendance/export';
import { campActor, campClock } from '@buxa/server/composers/index.server';
import { onSiteSummary, toOnSiteRow } from '@buxa/shared';

/** Everyone on site now, oldest arrival first, with check-out for staff. */
export async function OnSiteScreen() {
  const actor = await campActor();
  if (!actor) notFound();
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

  return (
    <div className="page">
      <PageHeader title="On site" subtitle={onSiteSummary(rows.length)} />
      {rows.length === 0 ? (
        <Empty icon="clock" title="No one is on site" body="People appear here when they are checked in." />
      ) : (
        <div id={ON_SITE_LIST_ID} tabIndex={-1} className="onsite-wrap">
          <ul className="onsite-list" aria-label="People on site">
            {rows.map(row => <OnSiteRow key={row.personId} row={row} canRecord={canRecord} canOverride={canOverride} />)}
          </ul>
        </div>
      )}
    </div>
  );
}
