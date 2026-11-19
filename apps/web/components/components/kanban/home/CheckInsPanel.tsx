'use client';

import { useState } from 'react';
import type { CheckInsByDay } from '@buxa/shared/camp/campHomeTypes';
import { periodChange } from '@buxa/shared/kanban/homeCards';
import { Pill, Segmented } from '@/components/elements';
import { ChartCard } from '@/components/components/charts/ChartCard';
import {
  CHECK_IN_RANGES,
  type CheckInRange,
  chartTotals,
  dayOfMonth,
  lastDays,
  shortDate,
  showAxisLabel,
} from './homeChartMath';
import { PARENTS_LABEL, STUDENTS_LABEL } from './ageGroups';

/**
 * People checked in per camp-local day, as stacked columns: parents and guardians at the base, students on top, the day's total
 * above each column, and a faint band joining each total to the next. A range picker chooses 7, 14 or 30 days, and each comes with a
 * change against the same number of days before. The table under the chart is the full text alternative. A null series means the
 * viewer's role may not read attendance, so the panel says that instead.
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
  const peak = Math.max(1, busiest?.count ?? 0);
  const n = days.length;
  // The band joins each column's top centre to the next: a polygon over the bar area, in a 0 to 100 box (y = 100 is the base).
  const band = [`0,100`, ...days.map((day, i) => `${i + 0.5},${100 - (day.count / peak) * 100}`), `${n},100`].join(' ');

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
          <div className="home-stack">
            <svg
              className="home-band"
              viewBox={`0 0 ${n} 100`}
              preserveAspectRatio="none"
              aria-hidden="true"
              focusable="false"
            >
              <polygon points={band} />
            </svg>
            <ol className="home-bars" aria-label={`Check-ins per day, last ${range} days`}>
              {days.map((day, i) => {
                const adults = day.minors === null ? day.count : day.count - day.minors;

                return (
                  <li key={day.date} className="home-bar">
                    <span className="home-bar-value" aria-hidden="true">
                      {day.count > 0 ? day.count : ''}
                    </span>
                    <span className="home-bar-track">
                      <span className="home-stack-col" style={{ height: `${(day.count / peak) * 100}%` }}>
                        {day.minors !== null && day.minors > 0 && (
                          <span className="home-seg home-seg-students" style={{ flexGrow: day.minors }} />
                        )}
                        {adults > 0 && <span className="home-seg home-seg-parents" style={{ flexGrow: adults }} />}
                      </span>
                    </span>
                    <span className="home-bar-label" aria-hidden="true">
                      {showAxisLabel(i, days.length) ? dayOfMonth(day.date) : ''}
                    </span>
                    <span className="sr-only">
                      {shortDate(day.date)}: {day.count} {day.count === 1 ? 'person' : 'people'}
                      {day.minors !== null && ` (${PARENTS_LABEL} ${adults}, ${STUDENTS_LABEL} ${day.minors})`}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
          <ul className="home-chart-legend" aria-label="Legend">
            <li>
              <span className="home-sw home-seg-parents" aria-hidden="true" />
              {PARENTS_LABEL}
            </li>
            {split && (
              <li>
                <span className="home-sw home-seg-students" aria-hidden="true" />
                {STUDENTS_LABEL}
              </li>
            )}
          </ul>
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
