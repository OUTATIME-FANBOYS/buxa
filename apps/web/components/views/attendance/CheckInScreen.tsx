import { notFound } from 'next/navigation';
import { authorize } from '@buxa/domain';
import { Empty } from '@/components/components';
import { PageHeader } from '@/components/components';
import { CheckInConsole } from '@/components/components/attendance';
import { DeskFamilyCheckIn, GateLinkPanel, type DeviceLine } from '@/components/components/gate';
import {
  campActor,
  campClock,
  loadCheckInSessions,
  loadDeskDevices,
  loadGateLinkToken,
} from '@buxa/server/composers/index.server';

/** The check-in page. Without attendance:record the person gets a friendly answer, not an error. */
export async function CheckInScreen() {
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
      <PageHeader title="Check-in" subtitle="Scan a badge or find a name." />
      <CheckInConsole timeZone={timeZone} clockFormat={clockFormat} canOverride={canOverride} sessions={sessions} />
      <DeskFamilyCheckIn />
      <GateLinkPanel
        initialToken={link?.kind === 'ok' ? link.value : null}
        canRotate={canManageLink}
        devices={deviceLines}
      />
    </div>
  );
}
