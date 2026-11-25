'use client';

import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { anySpanOverlaps, MAX_AGE_LIMIT, type ClockFormat } from '@buxa/domain';
import { type CustomField, type FormAttachment, type RegistrationSeries } from '@buxa/contracts';
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_HINT,
  fieldError,
  formatCampTime,
  idle,
  parentOnFile,
  seriesDaysLabel,
  type CamperRecord,
} from '@buxa/shared';
import { Button, Checkbox, DatePicker, FileField, RadioGroup, Select, TextField } from '@/components/elements';
import { registrationFormFilePath, registrationFormPath } from '@/config/routes';
import { submitRegistrationAction } from '@/actions/registration';
import { ActionMessage } from '@/components/components/classes/forms';
import { ChildPicker } from './ChildPicker';

/*
 * Records one family's registration on a published form. The family's children are chosen first (from People), then the class
 * series each child takes: one choice per series, not per day. The session is never picked: it comes with the series. A child cannot
 * take two series with a day that overlaps, and that is said here as it happens (the server checks the same rule again). The names
 * are `selections` (camperId|anchorClassId, the series' anchor day), `standard.<key>` and `custom.<key>`. In a dialog
 * (`variant="dialog"`) the buttons belong to the dialog's pinned footer, tied by `id`.
 */

const CHOICE_AS_RADIOS = 4;
const YES_NO = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

export interface RegisterSession {
  id: string;
  name: string;
  series: readonly RegistrationSeries[];
}

/** A child a family can register, with the details the form fills in from the person record (see CamperRecord). */
export type RegisterCamper = CamperRecord;

/** A section heading with its required mark: one asterisk, the field's own label carries no mark. */
function SectionTitle({ id, required, children }: { id: string; required?: boolean; children: string }) {
  return (
    <h3 id={id} className="form-section__title">
      {children}
      {required ? (
        <span className="field-required" aria-hidden="true">
          {' *'}
        </span>
      ) : null}
    </h3>
  );
}

/** "3 left", or "Full: waitlist" when the series has no place (the family is put on the waitlist). */
function seatLabel(series: Pick<RegistrationSeries, 'capacity' | 'seatsTaken'>): string {
  const left = series.capacity - series.seatsTaken;

  return left > 0 ? `${left} ${left === 1 ? 'place' : 'places'} left` : 'Full: waitlist';
}

/** The series' clock times, from its first active day (camp time), as the Classes table shows them. */
function timesLabel(series: RegistrationSeries, timeZone: string, clockFormat: ClockFormat): string {
  const first = series.occurrences[0];
  if (!first) {
    return `${series.startTime} to ${series.endTime}`;
  }

  return `${formatCampTime(first.startsAt, timeZone, clockFormat)} to ${formatCampTime(first.endsAt, timeZone, clockFormat)}`;
}

function ageLabel(series: Pick<RegistrationSeries, 'ageRange'>): string {
  const { minAge, maxAge } = series.ageRange;
  if (minAge === 0 && maxAge >= MAX_AGE_LIMIT) {
    return 'All ages';
  }

  return maxAge >= MAX_AGE_LIMIT ? `Ages ${minAge}+` : `Ages ${minAge} to ${maxAge}`;
}

/** One child's chosen series: the child, and the series' anchor day. */
interface Choice {
  camperId: string;
  classId: string;
}

export function RegisterForm({
  formId,
  id,
  variant = 'page',
  sessions,
  campers,
  timeZone,
  clockFormat,
  fields,
  attachments = [],
  onPendingChange,
  onSaved,
}: {
  formId: string;
  /** The form element's id, for a dialog footer's submit button to name with its `form` attribute. */
  id?: string;
  variant?: 'page' | 'dialog';
  sessions: readonly RegisterSession[];
  /** The children a family can register: people with the camper role. */
  campers: readonly RegisterCamper[];
  timeZone: string;
  clockFormat: ClockFormat;
  fields: readonly CustomField[];
  /** The files the form offers to download. Each link names the session the family is registering for (see downloadSessionId). */
  attachments?: readonly FormAttachment[];
  onPendingChange?: (pending: boolean) => void;
  /** Runs with the server's message when the registration is recorded (a pop-up closes and toasts it). */
  onSaved?: (message: string) => void;
}) {
  const [state, formAction, pending] = useActionState(submitRegistrationAction, idle);
  const formRef = useRef<HTMLFormElement>(null);
  const inDialog = variant === 'dialog';
  const [childIds, setChildIds] = useState<string[]>([]);
  const [picks, setPicks] = useState<Choice[]>([]);
  // The one clash the family just tried to choose, shown under its class. Cleared by the next change.
  const [clash, setClash] = useState<{ key: string; message: string } | null>(null);

  // Each choice is keyed by its series' anchor day (the id the server takes a place against).
  const seriesByAnchor = useMemo(() => {
    const map = new Map<string, RegistrationSeries>();
    for (const session of sessions) {
      for (const series of session.series) {
        map.set(series.anchorClassId, series);
      }
    }

    return map;
  }, [sessions]);

  useEffect(() => {
    if (state.status === 'error' && state.fieldErrors) {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  }, [state]);

  useEffect(() => {
    onPendingChange?.(pending);
  }, [pending, onPendingChange]);
  useEffect(() => {
    if (state.status === 'success') {
      onSaved?.(state.message ?? 'Registration recorded.');
    }
  }, [state, onSaved]);

  // A child taken off the tags also loses the classes chosen for them, so the submission never carries a removed child.
  function setChildren(ids: string[]) {
    setClash(null);
    setChildIds(ids);
    setPicks(current => current.filter(p => ids.includes(p.camperId)));
  }

  function togglePlace(camperId: string, series: RegistrationSeries, on: boolean) {
    setClash(null);
    if (!on) {
      setPicks(current => current.filter(p => !(p.camperId === camperId && p.classId === series.anchorClassId)));

      return;
    }
    const taken = picks.filter(p => p.camperId === camperId).map(p => seriesByAnchor.get(p.classId));
    const other = taken.find(
      (t): t is RegistrationSeries => t !== undefined && anySpanOverlaps(t.occurrences, series.occurrences),
    );
    if (other) {
      setClash({
        key: `${camperId}|${series.anchorClassId}`,
        message: `This clashes with ${other.name}, which is already chosen for this child. Untick that one first.`,
      });

      return;
    }
    setPicks(current => [...current, { camperId, classId: series.anchorClassId }]);
  }

  const err = (name: string) => fieldError(state, name);
  const chosenChildren = campers.filter(c => childIds.includes(c.id));
  // The lead child fills in the camper details and the parent or guardian: the first child with a class chosen, else the first child
  // chosen. The picks are posted with the lead's first, so the server reads the same child (its first selection) on submit.
  const leadId = childIds.find(id => picks.some(p => p.camperId === id)) ?? childIds[0];
  const lead = campers.find(c => c.id === leadId) ?? null;
  const rank = (camperId: string) => (camperId === leadId ? 0 : childIds.indexOf(camperId) + 1);
  const orderedPicks = [...picks].sort((a, b) => rank(a.camperId) - rank(b.camperId));
  const leadKey = lead?.id ?? 'none';
  const parent = lead?.parent ?? null;
  const parentFilled = parentOnFile(parent);
  // The session a family's download is for: the session of the first series they chose, else the form's first session.
  const downloadSessionId =
    sessions.find(s => s.series.some(x => picks.some(p => p.classId === x.anchorClassId)))?.id ??
    sessions[0]?.id ??
    null;

  return (
    <form
      id={id}
      ref={formRef}
      action={formAction}
      noValidate
      className={`${inDialog ? '' : 'panel '}class-form registration-register`}
    >
      <input type="hidden" name="formId" value={formId} />
      {orderedPicks.map(p => (
        <input
          key={`${p.camperId}|${p.classId}`}
          type="hidden"
          name="selections"
          value={`${p.camperId}|${p.classId}`}
        />
      ))}
      <p className="muted">Fields marked with an asterisk are required. Nothing is charged here.</p>

      <section className="form-section">
        {campers.length === 0 ? (
          <>
            <SectionTitle id="register-children" required>
              Children
            </SectionTitle>
            <p className="muted">
              No children are in People yet. Add the child there, with a household, and then come back.
            </p>
          </>
        ) : (
          <ChildPicker
            label="Children"
            people={campers}
            chosen={childIds}
            onChange={setChildren}
            error={chosenChildren.length === 0 ? err('selections') : undefined}
          />
        )}
      </section>

      {chosenChildren.length > 0 && (
        <section className="form-section" aria-labelledby="register-classes">
          <SectionTitle id="register-classes" required>
            Classes
          </SectionTitle>
          <p className="muted">
            Choose the classes for each child. A class is a series of days: choose it once. Two classes with a day that
            overlaps in time cannot both be chosen for one child.
          </p>
          {err('selections') && (
            <span className="field-error" role="alert">
              {err('selections')}
            </span>
          )}
          {chosenChildren.map(child => (
            <fieldset key={child.id} className="form-section" aria-label={child.name}>
              {/* The child's name is for screen readers only: the choices under it are the child's, and the name is not shown. */}
              <legend className="sr-only">{child.name}</legend>
              {sessions.map(session =>
                session.series.length === 0 ? null : (
                  <div key={session.id} className="check-group">
                    {session.series.map(series => {
                      const selected = picks.some(p => p.camperId === child.id && p.classId === series.anchorClassId);
                      const key = `${child.id}|${series.anchorClassId}`;

                      return (
                        <div key={series.id}>
                          <Checkbox isSelected={selected} onChange={on => togglePlace(child.id, series, on)}>
                            {`${series.name}. ${ageLabel(series)}. ${seriesDaysLabel(series.weekdays)}, ${timesLabel(series, timeZone, clockFormat)}, ${seatLabel(series)}`}
                          </Checkbox>
                          {clash?.key === key && (
                            <span className="field-error" role="alert">
                              {clash.message}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ),
              )}
            </fieldset>
          ))}
        </section>
      )}

      {attachments.length > 0 && (
        <section className="form-section" aria-labelledby="register-files">
          <SectionTitle id="register-files">Forms to download</SectionTitle>
          <ul className="form-files">
            {attachments.map(file => (
              <li key={file.id} className="form-file">
                <span className="form-file__name">{file.name}</span>
                {downloadSessionId ? (
                  <Button variant="glass" href={registrationFormFilePath(file.id, downloadSessionId)}>
                    Download
                  </Button>
                ) : (
                  <span className="muted">Choose a class to download this form.</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* The camper's details come from the first child chosen, and are read only: they change on the person's page. */}
      <section key={`camper-${leadKey}`} className="form-section" aria-labelledby="register-camper-details">
        <SectionTitle id="register-camper-details">Camper details</SectionTitle>
        <p className="muted">Filled in from the person&apos;s page. Change them there.</p>
        <div className="people-form-grid">
          <TextField
            label="First name"
            name="standard.camperFirstName"
            value={lead?.givenName ?? ''}
            isReadOnly
            isRequired
            error={err('standard.camperFirstName')}
            maxLength={80}
            autoComplete="off"
          />
          <TextField
            label="Last name"
            name="standard.camperLastName"
            value={lead?.familyName ?? ''}
            isReadOnly
            isRequired
            error={err('standard.camperLastName')}
            maxLength={80}
            autoComplete="off"
          />
        </div>
        <div className="form-pair">
          <DatePicker
            label="Date of birth"
            name="standard.camperBirthDate"
            value={lead?.dateOfBirth ?? ''}
            isReadOnly
            isRequired
            error={err('standard.camperBirthDate')}
          />
          <TextField
            label="Phone"
            type="tel"
            name="standard.guardianPhone"
            value={parentFilled ? (parent?.phone ?? '') : undefined}
            defaultValue={parentFilled ? undefined : (parent?.phone ?? '')}
            isReadOnly={parentFilled}
            isRequired
            error={err('standard.guardianPhone')}
            maxLength={32}
            autoComplete="off"
          />
        </div>
      </section>

      {/* The parent or guardian is on the child's household. When none is on file, these are typed and saved to the household. */}
      <section key={`parent-${leadKey}`} className="form-section" aria-labelledby="register-parent">
        <SectionTitle id="register-parent">Parent or guardian</SectionTitle>
        <p className="muted">
          {lead === null
            ? 'Choose a child first, and their household’s parent or guardian is filled in here.'
            : parentFilled
              ? 'Filled in from the household. Change it on the person’s page.'
              : 'Not on file yet. It is saved to the household when the registration is recorded.'}
        </p>
        <TextField
          label="Name"
          name="standard.guardianName"
          value={parentFilled ? (parent?.name ?? '') : undefined}
          defaultValue={parentFilled ? undefined : (parent?.name ?? '')}
          isReadOnly={parentFilled}
          isRequired
          error={err('standard.guardianName')}
          maxLength={120}
          autoComplete="off"
        />
        <TextField
          label="Email"
          type="email"
          name="standard.guardianEmail"
          value={parentFilled ? (parent?.email ?? '') : undefined}
          defaultValue={parentFilled ? undefined : (parent?.email ?? '')}
          isReadOnly={parentFilled}
          error={err('standard.guardianEmail')}
          maxLength={254}
          autoComplete="off"
        />
      </section>

      {fields.length > 0 && (
        <section className="form-section" aria-labelledby="register-questions">
          <SectionTitle id="register-questions">Questions</SectionTitle>
          {fields.map(field => {
            const name = `custom.${field.key}`;
            const error = err(name);
            if (field.kind === 'document') {
              // A file, sent with the registration. A required one that is missing does not stop it: staff see Not received.
              return (
                <div key={field.key} className="document-field">
                  <FileField label={field.label} name={name} accept={ATTACHMENT_ACCEPT} error={error} />
                  <span className="field-hint">
                    {field.required ? 'Expected. ' : ''}
                    {ATTACHMENT_HINT}
                  </span>
                </div>
              );
            }
            if (field.kind === 'text') {
              return (
                <TextField
                  key={field.key}
                  label={field.label}
                  name={name}
                  error={error}
                  isRequired={field.required}
                  maxLength={2000}
                  autoComplete="off"
                />
              );
            }
            if (field.kind === 'date') {
              return (
                <DatePicker key={field.key} label={field.label} name={name} error={error} isRequired={field.required} />
              );
            }
            if (field.kind === 'yes_no') {
              return (
                <RadioGroup
                  key={field.key}
                  label={field.label}
                  name={name}
                  options={YES_NO}
                  error={error}
                  isRequired={field.required}
                />
              );
            }
            const options = field.options.map(value => ({ value, label: value }));

            return options.length <= CHOICE_AS_RADIOS ? (
              <RadioGroup
                key={field.key}
                label={field.label}
                name={name}
                options={options}
                error={error}
                isRequired={field.required}
              />
            ) : (
              <Select
                key={field.key}
                label={field.label}
                name={name}
                options={options}
                error={error}
                isRequired={field.required}
                placeholder="Choose"
              />
            );
          })}
        </section>
      )}

      <ActionMessage state={state} />
      {!inDialog && (
        <div className="classes-actions">
          <Button type="submit" variant="primary" disabled={pending} className="classes-target">
            {pending ? 'Recording...' : 'Record registration'}
          </Button>
          <Button variant="glass" className="classes-target" href={registrationFormPath(formId)}>
            Back to the form
          </Button>
        </div>
      )}
    </form>
  );
}
