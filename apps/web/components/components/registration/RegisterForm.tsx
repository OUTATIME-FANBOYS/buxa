'use client';

import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { MAX_AGE_LIMIT, overlaps, type ClockFormat } from '@buxa/domain';
import { STANDARD_FIELDS, type Class, type CustomField, type FormAttachment } from '@buxa/contracts';
import { ATTACHMENT_ACCEPT, ATTACHMENT_HINT, fieldError, formatCampDateTime, idle } from '@buxa/shared';
import { Button, Checkbox, DatePicker, FileField, RadioGroup, Select, TextField } from '@/components/elements';
import { registrationFormFilePath, registrationFormPath } from '@/config/routes';
import { submitRegistrationAction } from '@/actions/registration';
import { ActionMessage } from '@/components/components/classes/forms';
import { ChildPicker } from './ChildPicker';

/*
 * Records one family's registration on a published form. The family's children are chosen first (from People), then the classes
 * each child takes. The session is never picked: it comes with the class. A child cannot take two classes whose times overlap, and
 * that is said here as it happens (the server checks the same rule again). The names are `selections` (camperId|classId), `standard.<key>`
 * and `custom.<key>`. In a dialog (`variant="dialog"`) the buttons belong to the dialog's pinned footer, tied by `id`.
 */

/** The standard questions, in the order a family answers them, under one short heading each. Labels are short: the heading gives the context. */
type StandardKey = (typeof STANDARD_FIELDS)[number]['key'];

const GROUPS: { title: string; keys: StandardKey[]; labels: Partial<Record<StandardKey, string>> }[] = [
  {
    title: 'Camper details',
    keys: ['camperFirstName', 'camperLastName', 'camperBirthDate'],
    labels: { camperFirstName: 'First name', camperLastName: 'Last name', camperBirthDate: 'Date of birth' },
  },
  {
    title: 'Parent or guardian',
    keys: ['guardianName', 'guardianEmail', 'guardianPhone'],
    labels: { guardianName: 'Name', guardianEmail: 'Email', guardianPhone: 'Phone' },
  },
  {
    title: 'Emergency contact',
    keys: ['emergencyContactName', 'emergencyContactPhone'],
    labels: { emergencyContactName: 'Name', emergencyContactPhone: 'Phone' },
  },
];

const REQUIRED = new Map(STANDARD_FIELDS.map(f => [f.key, f.required]));
const CHOICE_AS_RADIOS = 4;
const YES_NO = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

export interface RegisterSession {
  id: string;
  name: string;
  classes: Class[];
}

export interface RegisterCamper {
  id: string;
  name: string;
}

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

/** "3 left", or "Full: waitlist" when the class has no place (the family is put on the waitlist). */
function seatLabel(cls: Class): string {
  const left = cls.capacity - cls.seatsTaken;

  return left > 0 ? `${left} ${left === 1 ? 'place' : 'places'} left` : 'Full: waitlist';
}

function ageLabel(cls: Class): string {
  const { minAge, maxAge } = cls.ageRange;
  if (minAge === 0 && maxAge >= MAX_AGE_LIMIT) {
    return 'All ages';
  }

  return maxAge >= MAX_AGE_LIMIT ? `Ages ${minAge}+` : `Ages ${minAge} to ${maxAge}`;
}

interface Pick {
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
  const [picks, setPicks] = useState<Pick[]>([]);
  // The one clash the family just tried to choose, shown under its class. Cleared by the next change.
  const [clash, setClash] = useState<{ key: string; message: string } | null>(null);

  const classById = useMemo(() => {
    const map = new Map<string, Class>();
    for (const session of sessions) {
      for (const cls of session.classes) {
        map.set(cls.id, cls);
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

  function togglePlace(camperId: string, cls: Class, on: boolean) {
    setClash(null);
    if (!on) {
      setPicks(current => current.filter(p => !(p.camperId === camperId && p.classId === cls.id)));

      return;
    }
    const taken = picks.filter(p => p.camperId === camperId).map(p => classById.get(p.classId));
    const other = taken.find((t): t is Class => t !== undefined && overlaps(t, cls));
    if (other) {
      setClash({
        key: `${camperId}|${cls.id}`,
        message: `This clashes with ${other.name}, which is already chosen for this child. Untick that one first.`,
      });

      return;
    }
    setPicks(current => [...current, { camperId, classId: cls.id }]);
  }

  const err = (name: string) => fieldError(state, name);
  const chosenChildren = campers.filter(c => childIds.includes(c.id));
  // The session a family's download is for: the session of the first class they chose, else the form's first session.
  const downloadSessionId =
    sessions.find(s => s.classes.some(c => picks.some(p => p.classId === c.id)))?.id ?? sessions[0]?.id ?? null;

  return (
    <form
      id={id}
      ref={formRef}
      action={formAction}
      noValidate
      className={`${inDialog ? '' : 'panel '}class-form registration-register`}
    >
      <input type="hidden" name="formId" value={formId} />
      {picks.map(p => (
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
            Choose the classes for each child. Two classes that overlap in time cannot both be chosen for one child.
          </p>
          {err('selections') && (
            <span className="field-error" role="alert">
              {err('selections')}
            </span>
          )}
          {chosenChildren.map(child => (
            <fieldset key={child.id} className="form-section">
              <legend className="form-section__title">{child.name}</legend>
              {sessions.map(session =>
                session.classes.length === 0 ? null : (
                  <div key={session.id} className="check-group">
                    <p className="muted">{session.name}</p>
                    {session.classes.map(cls => {
                      const selected = picks.some(p => p.camperId === child.id && p.classId === cls.id);
                      const key = `${child.id}|${cls.id}`;

                      return (
                        <div key={cls.id}>
                          <Checkbox isSelected={selected} onChange={on => togglePlace(child.id, cls, on)}>
                            {`${cls.name}. ${ageLabel(cls)}. ${formatCampDateTime(cls.startsAt, timeZone, clockFormat)}, ${seatLabel(cls)}`}
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

      {GROUPS.map(group => {
        const titleId = `register-${group.title.replace(/\s+/g, '-').toLowerCase()}`;

        return (
          <section key={group.title} className="form-section" aria-labelledby={titleId}>
            <SectionTitle id={titleId}>{group.title}</SectionTitle>
            {group.keys.map(key => {
              const name = `standard.${key}`;
              const required = REQUIRED.get(key) ?? false;
              const text = group.labels[key] ?? key;
              if (key === 'camperBirthDate') {
                return <DatePicker key={key} label={text} name={name} error={err(name)} isRequired={required} />;
              }
              const type = key === 'guardianEmail' ? 'email' : key.endsWith('Phone') ? 'tel' : 'text';

              return (
                <TextField
                  key={key}
                  label={text}
                  name={name}
                  type={type}
                  error={err(name)}
                  isRequired={required}
                  maxLength={120}
                  autoComplete="off"
                />
              );
            })}
          </section>
        );
      })}

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
