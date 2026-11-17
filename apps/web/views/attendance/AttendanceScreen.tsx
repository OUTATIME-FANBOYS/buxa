import { notFound } from 'next/navigation';
import { authorize, toLocalDate } from '@buxa/domain';
import { Empty } from '@/components';
import { PageHeader } from '@/components';
import { loadLogEntries, loadPeopleOptions } from '@buxa/server/composers/index.server';
import { Notice } from '@/components';
import { LogFilters } from '@/components';
import { LogTable } from '@/components';
import { campActor, campZone } from '@buxa/server/composers/index.server';
import { attendanceExportPath } from '@buxa/shared';
import { parseLogFilter } from '@buxa/shared';
import { HELP_LINK_LABEL, helpLink } from '@buxa/shared';

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
  const timeZone = await campZone(actor);
  const parsed = parseLogFilter(searchParams, toLocalDate(new Date(), timeZone));
  const [people, entries] = await Promise.all([
    loadPeopleOptions(actor),
    parsed.ok ? loadLogEntries(actor, parsed.filter) : Promise.resolve([]),
  ]);
  const canExport = authorize(actor, 'attendance:export').allow;
  const values = parsed.ok
    ? { from: parsed.filter.from, to: parsed.filter.to, personId: parsed.filter.personId ?? '' }
    : { from: readValue(searchParams, 'from'), to: readValue(searchParams, 'to'), personId: readValue(searchParams, 'personId') };

  return (
    <div className="page">
      <PageHeader title="Attendance" subtitle="Who came in and out, in camp time." actions={<a className="btn" href={helpLink('exports')}>{HELP_LINK_LABEL}</a>} />
      <LogFilters values={values} people={people}>
        {parsed.ok && canExport && <a className="btn log-export" href={attendanceExportPath(parsed.filter)} download>Download CSV</a>}
      </LogFilters>
      {!parsed.ok && <Notice tone="crit" title="Check the dates" body={parsed.message} />}
      {parsed.ok && entries.length === 0 && <Empty icon="list" title="No visits for these days" body="Try a wider range, or another person." />}
      {parsed.ok && entries.length > 0 && <LogTable entries={entries} timeZone={timeZone} />}
    </div>
  );
}

const readValue = (params: SearchParams, name: string): string => {
  const value = params[name];
  return typeof value === 'string' ? value : '';
};
