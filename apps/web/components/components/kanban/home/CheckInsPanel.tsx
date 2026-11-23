'use client';

import { useState } from 'react';
import type { CheckInsByDay } from '@buxa/shared/camp/campHomeTypes';
import { periodChange } from '@buxa/shared/kanban/homeCards';
import { Pill, Segmented } from '@/components/elements';
import { Bars, ChartCard } from '@/components/components/charts';
import { CHECK_IN_RANGES, type CheckInRange, chartTotals, dayOfMonth, lastDays, shortDate } from './homeChartMath';
import { PARENTS_LABEL, STUDENTS_LABEL } from './ageGroups';

/**
 * People checked in per camp-local day, as columns with the day's total on each and a date under it. A range picker chooses 7, 14 or 30
 * days, and each comes with a change against the same number of days before. The table under the chart is the full text alternative,
 * and it carries the parents and students split when this viewer may see it. A null series means the viewer's role may not read
 * attendance, so the panel says that instead.
 */
export function CheckInsPanel({ series }: { series: CheckInsByDay | null }) {
  const [range, setRange] = useState<CheckInRange>(14);
  if (series === null) {
    return (
      <section className="panel" aria-labelledby="check-ins-title">
        <div className="panel-head">
          <h2 id="check-ins-title">Check-ins per day</h2>
        </div>
        <p className="muted">Attendance is not shown for your role.</p>
      </section>
    );
  }
  const days = lastDays(series.days, range);
  const { total, busiest } = chartTotals(days);
  const first = days[0];
  const last = days[days.length - 1];
  const split = days.some(day => day.minors !== null);
  const change = periodChange(series, range);
  const bars = days.map(day => ({ label: dayOfMonth(day.date), value: day.count, title: shortDate(day.date) }));

  return (
    <ChartCard
      titleId="check-ins-title"
      title="Check-ins per day"
      action={
        <Segmented<string>
          label="Date range"
          value={String(range)}
          onChange={value => setRange(Number(value) as CheckInRange)}
          options={CHECK_IN_RANGES.map(n => ({ value: String(n), label: `${n} days` }))}
        />
      }
      value={total}
      badge={
        change && (
          <Pill tone={change.tone} dot={false}>
            {change.text}
          </Pill>
        )
      }
      subtitle={
        <>
          {total} {total === 1 ? 'person' : 'people'} checked in from {shortDate(first.date)} to {shortDate(last.date)}.
          {busiest ? ` Busiest day: ${shortDate(busiest.date)}, ${busiest.count}.` : ''}
        </>
      }
    >
      {!series.complete && (
        <p className="home-note small">
          This camp has more visits in the last {series.days.length} days than the page can count, so the older days may
          be short. The Attendance log shows every visit.
        </p>
      )}
      {total === 0 ? (
        <p className="muted">No check-ins in the last {range} days.</p>
      ) : (
        <>
          <Bars data={bars} unit="people" ariaLabel={`Check-ins per day, last ${range} days, ${total} in total`} />
          {!split && (
            <p className="muted small">
              The split between {PARENTS_LABEL} and {STUDENTS_LABEL} is not shown for your role.
            </p>
          )}
          <details className="home-table-alt">
            <summary className="link">Show as a table</summary>
            <table className="home-table">
              <caption className="sr-only">Check-ins per day, last {range} days</caption>
              {split ? (
                <>
                  <thead>
                    <tr>
                      <th scope="col">Day</th>
                      <th scope="col">{PARENTS_LABEL}</th>
                      <th scope="col">{STUDENTS_LABEL}</th>
                      <th scope="col">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {days.map(day => (
                      <tr key={day.date}>
                        <td>{shortDate(day.date)}</td>
                        <td>{day.count - (day.minors ?? 0)}</td>
                        <td>{day.minors ?? 0}</td>
                        <td>{day.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </>
              ) : (
                <>
                  <thead>
                    <tr>
                      <th scope="col">Day</th>
                      <th scope="col">People checked in</th>
                    </tr>
                  </thead>
                  <tbody>
                    {days.map(day => (
                      <tr key={day.date}>
                        <td>{shortDate(day.date)}</td>
                        <td>{day.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}
            </table>
          </details>
        </>
      )}
    </ChartCard>
  );
}
