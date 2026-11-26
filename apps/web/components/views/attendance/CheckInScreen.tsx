import { notFound } from 'next/navigation';
import { authorize } from '@buxa/domain';
import { resolveCheckInTab, visibleCheckInTabs, type CheckInTab } from '@buxa/shared';
import { Empty } from '@/components/components';
import { PageHeader } from '@/components/components';
import { CheckInConsole, CheckInTabs } from '@/components/components/attendance';
import { DeskFamilyCheckIn, GateLinkPanel, PhonesVerifiedPanel, type DeviceLine } from '@/components/components/gate';
import {
  campActor,
  campClock,
  loadCheckInSessions,
  loadDeskDevices,
  loadGateLinkToken,
} from '@buxa/server/composers/index.server';

type SearchParams = Readonly<Record<string, string | string[] | undefined>>;

/**
 * The check-in page: one header, then tabs. Scan or find is the default (see CheckInTab). Every visible tab stays mounted and only the
 * open one is shown, so a check-in or a family code in progress is not lost when the person looks at another tab.
 * Without attendance:record the person gets a friendly answer, not an error.
 */
export async function CheckInScreen({ searchParams }: { searchParams: SearchParams }) {
  const actor = await campActor();
  if (!actor) {
    notFound();
  }
  if (!authorize(actor, 'attendance:record').allow) {
    return (
      <div className="page">
        <PageHeader title="Check-in" />
        {actor.archived ? (
          <Empty icon="users" title="This camp is archived" body="Arrivals cannot be recorded in an archived camp." />
        ) : (
          <Empty
            icon="users"
            title="Ask a staff member to check people in"
            body="Your role does not record arrivals."
          />
        )}
      </div>
    );
  }
  const { timeZone, clockFormat } = await campClock(actor);
  const canOverride = authorize(actor, 'attendance:override').allow;
  const sessions = await loadCheckInSessions(actor);
  const canManageLink = authorize(actor, 'org:update').allow;
  const tabs = visibleCheckInTabs(canManageLink);
  const tab: CheckInTab = resolveCheckInTab(searchParams.tab, tabs);
  const [devices, link] = await Promise.all([loadDeskDevices(), canManageLink ? loadGateLinkToken() : null]);
  const deviceLines: DeviceLine[] =
    devices.kind === 'ok'
      ? devices.value.map(d => ({
          deviceId: d.deviceId,
          householdName: d.householdName,
          issuedOn: d.issuedAt.toISOString().slice(0, 10),
          expiresOn: d.expiresAt.toISOString().slice(0, 10),
          revoked: d.revokedAt !== null,
        }))
      : [];

  return (
    <div className="page">
      <PageHeader
        title="Check-in"
        subtitle="Check people in: scan a badge, find a name, or check in a family by email."
      />
      <CheckInTabs tabs={tabs} active={tab} />
      <div hidden={tab !== 'scan'}>
        <CheckInConsole timeZone={timeZone} clockFormat={clockFormat} canOverride={canOverride} sessions={sessions} />
      </div>
      <div hidden={tab !== 'family'}>
        <DeskFamilyCheckIn />
      </div>
      {canManageLink ? (
        <div hidden={tab !== 'link'}>
          <GateLinkPanel initialToken={link?.kind === 'ok' ? link.value : null} canRotate={canManageLink} />
        </div>
      ) : null}
      <div hidden={tab !== 'phones'}>
        <PhonesVerifiedPanel devices={deviceLines} />
      </div>
    </div>
  );
}
