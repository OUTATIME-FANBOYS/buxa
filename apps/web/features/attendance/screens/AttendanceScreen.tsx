import { notFound } from 'next/navigation';
import { authorize, toLocalDate } from '@buxa/domain';
import { Empty } from '@/components/ui';
import { PageHeader } from '@/features/camp/components/PageHeader';
import { getRuntime } from '@/server/runtime';
import { Notice } from '../components/Notice';
import { LogFilters } from '../components/LogFilters';
import { LogTable } from '../components/LogTable';
import { campActor, campZone } from '../lib/campActor';
import { attendanceExportPath } from '../lib/paths';
import { parseLogFilter } from '../lib/logFilter';

type SearchParams = Readonly<Record<string, string | string[] | undefined>>;

/** The attendance log for the chosen camp days (default: today, camp time), with an optional person and the CSV download. */
export async function AttendanceScreen({ searchParams }: { searchParams: SearchParams }) {
  const actor = await campActor();
  if (!actor) notFound();
  if (!authorize(actor, 'attendance:read').allow) {
    return (
      <div className="page">
        <PageHeader title="Attendance" />
        <Empty icon="list" title="You cannot see the attendance log" body="Ask a staff member." />
      </div>
    );
  }
  const { services } = getRuntime();
  const timeZone = await campZone(actor);
  const parsed = parseLogFilter(searchParams, toLocalDate(new Date(), timeZone));
  const [people, entries] = await Promise.all([
    services.people.list(actor),
    parsed.ok ? services.attendance.log(actor, parsed.filter) : Promise.resolve([]),
  ]);
  const canExport = authorize(actor, 'attendance:export').allow;
  const values = parsed.ok
    ? { from: parsed.filter.from, to: parsed.filter.to, personId: parsed.filter.personId ?? '' }
    : { from: readValue(searchParams, 'from'), to: readValue(searchParams, 'to'), personId: readValue(searchParams, 'personId') };

  return (
    <div className="page">
      <PageHeader title="Attendance" subtitle="Who came in and out, in camp time." />
      <LogFilters values={values} people={people} />
      {!parsed.ok && <Notice tone="crit" title="Check the dates" body={parsed.message} />}
      {parsed.ok && (
        <div className="row-end">
          {canExport && <a className="btn att-btn-lg" href={attendanceExportPath(parsed.filter)} download>Download CSV</a>}
        </div>
      )}
      {parsed.ok && entries.length === 0 && <Empty icon="list" title="No visits for these days" body="Try a wider range, or another person." />}
      {parsed.ok && entries.length > 0 && <LogTable entries={entries} timeZone={timeZone} />}
    </div>
  );
}

const readValue = (params: SearchParams, name: string): string => {
  const value = params[name];
  return typeof value === 'string' ? value : '';
};
