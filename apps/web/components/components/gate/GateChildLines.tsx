'use client';

import { useState, type FormEvent } from 'react';
import { Button, Checkbox } from '@/components/atoms';
import type { GateChildLine } from '@buxa/shared';

/** What one check-in attempt came back as, in words the screen can show. */
export type ChildCheckResult = 'ok' | 'not_booked' | 'already_on_site' | 'refused';

const RESULT_TEXT: Record<ChildCheckResult, string> = {
  ok: 'Checked in',
  not_booked: 'Not booked for this session today',
  already_on_site: 'Already checked in',
  refused: 'Could not check in. Ask a staff member.',
};

const keyOf = (child: GateChildLine): string => `${child.personId}:${child.sessionId}`;

/**
 * The children booked today, one plain line each. The family (or staff) ticks the children who are here and checks them in. A child
 * already on site has no box. Each child is checked in on its own, so one refusal does not stop the others.
 */
export function GateChildLines({
  lines,
  checkIn,
  onDone,
}: {
  lines: GateChildLine[];
  checkIn: (child: GateChildLine) => Promise<ChildCheckResult>;
  onDone: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [results, setResults] = useState<Record<string, ChildCheckResult>>({});
  const [busy, setBusy] = useState(false);

  const setSelectedOne = (key: string, isOn: boolean) =>
    setSelected(previous => {
      const next = new Set(previous);
      if (isOn) {
        next.add(key);
      } else {
        next.delete(key);
      }

      return next;
    });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const chosen = lines.filter(child => selected.has(keyOf(child)) && !child.onSite);
    setBusy(true);
    for (const child of chosen) {
      const result = await checkIn(child);
      setResults(previous => ({ ...previous, [keyOf(child)]: result }));
    }
    setBusy(false);
    setSelected(new Set());
    onDone();
  }

  if (lines.length === 0) {
    return <p className="muted">No children are booked into a session today.</p>;
  }

  const available = lines.filter(child => !child.onSite);
  const pickable = available.filter(child => results[keyOf(child)] === undefined);

  return (
    <form
      onSubmit={event => {
        void submit(event);
      }}
      className="buxa:grid buxa:gap-3"
      aria-label="Children booked today"
    >
      <ul className="buxa:grid buxa:gap-3 buxa:list-none buxa:p-0">
        {lines.map(child => {
          const key = keyOf(child);
          const result = results[key];
          const name = `${child.givenName} ${child.familyName}`;
          if (child.onSite || result !== undefined) {
            return (
              <li key={key} className="buxa:flex buxa:justify-between buxa:gap-3 buxa:min-h-[44px] buxa:items-center">
                <span>
                  {name} <span className="muted">· {child.sessionName}</span>
                </span>
                <span className="muted">{RESULT_TEXT[result ?? 'already_on_site']}</span>
              </li>
            );
          }

          return (
            <li key={key} className="buxa:min-h-[44px] buxa:flex buxa:items-center">
              <Checkbox
                name="child"
                value={key}
                isSelected={selected.has(key)}
                onChange={isOn => setSelectedOne(key, isOn)}
                isDisabled={busy}
              >
                {`${name}`} <span className="muted">· {child.sessionName}</span>
              </Checkbox>
            </li>
          );
        })}
      </ul>
      {pickable.length > 0 ? (
        <Button variant="primary" fullWidth type="submit" icon="check" disabled={busy || selected.size === 0}>
          {busy
            ? 'Checking in…'
            : `Check in ${selected.size === 0 ? 'the children who are here' : `${selected.size} child${selected.size === 1 ? '' : 'ren'}`}`}
        </Button>
      ) : null}
    </form>
  );
}
