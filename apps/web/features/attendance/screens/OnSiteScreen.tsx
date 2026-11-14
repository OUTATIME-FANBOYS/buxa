import { notFound } from 'next/navigation';
import { authorize } from '@buxa/domain';
import { Empty } from '@/components/ui';
import { PageHeader } from '@/features/camp/components/PageHeader';
import { getRuntime } from '@/server/runtime';
import { ON_SITE_LIST_ID, OnSiteRow } from '../checkOut/OnSiteRow';
import { campActor, campZone } from '../lib/campActor';
import { onSiteSummary, toOnSiteRow } from '../lib/onSiteView';

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
  const { services } = getRuntime();
  const [entries, timeZone] = await Promise.all([services.attendance.onSite(actor), campZone(actor)]);
  const rows = entries.map(entry => toOnSiteRow(entry, timeZone));
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
