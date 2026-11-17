import { notFound } from 'next/navigation';
import { authorize } from '@buxa/domain';
import { Empty } from '@/components/components/export';
import { PageHeader } from '@/components/components/export';
import { CheckInConsole } from '@/components/components/attendance/export';
import { campActor, campClock } from '@buxa/server/composers/index.server';

/** The check-in page. Without attendance:record the person gets a friendly answer, not an error. */
export async function CheckInScreen() {
  const actor = await campActor();
  if (!actor) notFound();
  if (!authorize(actor, 'attendance:record').allow) {
    return (
      <div className="page">
        <PageHeader title="Check-in" />
        <Empty icon="users" title="Ask a staff member to check people in" body="Your role does not record arrivals." />
      </div>
    );
  }
  const { timeZone, clockFormat } = await campClock(actor);
  const canOverride = authorize(actor, 'attendance:override').allow;
  return (
    <div className="page">
      <PageHeader title="Check-in" subtitle="Scan a badge or find a name." />
      <CheckInConsole timeZone={timeZone} clockFormat={clockFormat} canOverride={canOverride} />
    </div>
  );
}
