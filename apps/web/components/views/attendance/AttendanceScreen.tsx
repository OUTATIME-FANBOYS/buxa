import { notFound } from 'next/navigation';
import { authorize, toLocalDate } from '@buxa/domain';
import { Empty } from '@/components/components';
import { PageHeader } from '@/components/components';
import { loadFilterChoices, loadLogEntries, loadPeopleOptions } from '@buxa/server/composers/index.server';
import { Notice } from '@/components/components';
import { AttendanceCsvDownload, LogFilters } from '@/components/components/attendance';
import { LogTable } from '@/components/components/attendance';
import { campActor, campClock } from '@buxa/server/composers/index.server';
import { parseLogFilter } from '@buxa/shared';
import { HELP_LINK_LABEL, helpLink } from '@buxa/shared';
import { Button } from '@/components/elements';

type SearchParams = Readonly<Record<string, string | string[] | undefined>>;

/** The attendance log for the chosen camp days (default: today, camp time), with an optional person and the CSV download. */
export async function AttendanceScreen({ searchParams }: { searchParams: SearchParams }) {
  const actor = await campActor();
  if (!actor) {
    notFound();
  }
  if (!authorize(actor, 'attendance:read').allow) {
    return (
      <div className="page">
        <PageHeader title="Attendance" />
        <Empty icon="list" title="You cannot see the attendance log" body="Ask a staff member." />
      </div>
    );
  }
  const { timeZone, clockFormat } = await campClock(actor);
  const parsed = parseLogFilter(searchParams, toLocalDate(new Date(), timeZone));
  const [people, entries, choices] = await Promise.all([
    loadPeopleOptions(actor),
    parsed.ok ? loadLogEntries(actor, parsed.filter) : Promise.resolve([]),
    loadFilterChoices(actor),
  ]);
  const canExport = authorize(actor, 'attendance:export').allow;
  const values = parsed.ok
    ? {
        from: parsed.filter.from,
        to: parsed.filter.to,
        personId: parsed.filter.personId ?? '',
        sessionId: parsed.filter.sessionId ?? '',
        classId: parsed.filter.classId ?? '',
        method: parsed.filter.method ?? '',
        checkedInBy: parsed.filter.checkedInBy ?? '',
        status: parsed.filter.status ?? '',
      }
    : {
        from: readValue(searchParams, 'from'),
        to: readValue(searchParams, 'to'),
        personId: readValue(searchParams, 'personId'),
        sessionId: readValue(searchParams, 'sessionId'),
        classId: readValue(searchParams, 'classId'),
        method: readValue(searchParams, 'method'),
        checkedInBy: readValue(searchParams, 'checkedInBy'),
        status: readValue(searchParams, 'status'),
      };

  return (
    <div className="page">
      <PageHeader
        title="Attendance"
        subtitle="Who came in and out, in camp time."
        actions={<Button href={helpLink('exports')}>{HELP_LINK_LABEL}</Button>}
      />
      <LogFilters values={values} people={people} choices={choices}>
        {parsed.ok && canExport && <AttendanceCsvDownload filter={parsed.filter} />}
      </LogFilters>
      {!parsed.ok && <Notice tone="crit" title="Check the dates" body={parsed.message} />}
      {parsed.ok && entries.length === 0 && (
        <Empty icon="list" title="No visits for these days" body="Try a wider range, or another person." />
      )}
      {parsed.ok && entries.length > 0 && <LogTable entries={entries} timeZone={timeZone} clockFormat={clockFormat} />}
    </div>
  );
}

const readValue = (params: SearchParams, name: string): string => {
  const value = params[name];

  return typeof value === 'string' ? value : '';
};
