'use client';

import { useState } from 'react';
import { ATTENDANCE_FIELD_IDS, ATTENDANCE_FIELD_LABELS, DEFAULT_ATTENDANCE_FIELDS } from '@buxa/contracts';
import type { AttendanceField, AttendanceFilter } from '@buxa/contracts';
import { attendanceExportPath, orderFields } from '@buxa/shared';
import { Checkbox } from '@/components/atoms';
import { FormPopUp } from '@/components/components/FormPopUp';
import { Button } from '@/components/elements';

const FORM_ID = 'attendance-csv-fields';

/**
 * "Download CSV": a small dialog that lists every column of the log as a checkbox. The file carries the ticked columns, in table
 * order, and only the rows the current filter shows. Download is off until a column is ticked. The columns are the shared list the
 * table uses, so the picker cannot drift from it. `navigate` starts the download (the default leaves the page on the file).
 */
export function AttendanceCsvDownload({
  filter,
  initialFields = DEFAULT_ATTENDANCE_FIELDS,
  navigate = href => window.location.assign(href),
}: {
  filter: AttendanceFilter;
  initialFields?: readonly AttendanceField[];
  navigate?: (href: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<ReadonlySet<AttendanceField>>(() => new Set(initialFields));
  const fields = orderFields(chosen);

  const setField = (field: AttendanceField, selected: boolean) =>
    setChosen(current => {
      const next = new Set(current);
      if (selected) {
        next.add(field);
      } else {
        next.delete(field);
      }

      return next;
    });

  return (
    <>
      <Button type="button" className="log-export" icon="download" onClick={() => setOpen(true)}>
        Download CSV
      </Button>
      {open ? (
        <FormPopUp
          title="Download CSV"
          intro="Choose the columns to include. The file has only the rows these filters show."
          formId={FORM_ID}
          submitLabel="Download"
          submitIcon="download"
          submitDisabled={fields.length === 0}
          onCancel={() => setOpen(false)}
        >
          <form
            id={FORM_ID}
            onSubmit={event => {
              event.preventDefault();
              navigate(attendanceExportPath(filter, fields));
              setOpen(false);
            }}
          >
            <div className="buxa:flex buxa:gap-[var(--s2)] buxa:mb-[var(--s3)]">
              <Button type="button" variant="ghost" size="sm" onClick={() => setChosen(new Set(ATTENDANCE_FIELD_IDS))}>
                All
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setChosen(new Set())}>
                None
              </Button>
            </div>
            <div className="buxa:grid buxa:gap-[var(--s2)]">
              {ATTENDANCE_FIELD_IDS.map(field => (
                <Checkbox
                  key={field}
                  name="fields"
                  value={field}
                  isSelected={chosen.has(field)}
                  onChange={selected => setField(field, selected)}
                >
                  {ATTENDANCE_FIELD_LABELS[field]}
                </Checkbox>
              ))}
            </div>
          </form>
        </FormPopUp>
      ) : null}
    </>
  );
}
