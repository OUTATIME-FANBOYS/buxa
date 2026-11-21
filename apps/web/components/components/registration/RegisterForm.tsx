'use client';

import { useActionState, useEffect, useRef } from 'react';
import { STANDARD_FIELDS, type CustomField } from '@buxa/contracts';
import { fieldError, idle } from '@buxa/shared';
import { Button, Checkbox, DatePicker, RadioGroup, Select, TextField } from '@/components/elements';
import { registrationFormPath } from '@/config/routes';
import { submitRegistrationAction } from '@/actions/registration';
import { ActionMessage } from '@/components/components/classes/forms';

/*
 * Records one family's registration on a published form: the sessions, the standard questions (camper, guardian, emergency contact)
 * and the form's own questions. The names are `standard.<key>`, `custom.<key>` and `sessionIds`, which the server reads and checks.
 * Each group is a section: a heading, a rule above it, then its fields. In a dialog (`variant="dialog"`) the buttons belong to the
 * dialog's pinned footer, tied by `id`, and `onPendingChange` reports the pending state to it.
 */

/** The standard questions, in the order a family answers them, under one short heading each. Labels are short: the heading gives the context. */
type StandardKey = (typeof STANDARD_FIELDS)[number]['key'];

const GROUPS: { title: string; keys: StandardKey[]; labels: Partial<Record<StandardKey, string>> }[] = [
  {
    title: 'Camper',
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

export function RegisterForm({
  formId,
  id,
  variant = 'page',
  sessions,
  fields,
  onPendingChange,
  onSaved,
}: {
  formId: string;
  /** The form element's id, for a dialog footer's submit button to name with its `form` attribute. */
  id?: string;
  variant?: 'page' | 'dialog';
  sessions: readonly { id: string; name: string }[];
  fields: readonly CustomField[];
  onPendingChange?: (pending: boolean) => void;
  /** Runs with the server's message when the registration is recorded (a pop-up closes and toasts it). */
  onSaved?: (message: string) => void;
}) {
  const [state, formAction, pending] = useActionState(submitRegistrationAction, idle);
  const formRef = useRef<HTMLFormElement>(null);
  const inDialog = variant === 'dialog';

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

  const err = (name: string) => fieldError(state, name);

  return (
    <form
      id={id}
      ref={formRef}
      action={formAction}
      noValidate
      className={`${inDialog ? '' : 'panel '}class-form registration-register`}
    >
      <input type="hidden" name="formId" value={formId} />
      <p className="muted">Fields marked with an asterisk are required. Nothing is charged here.</p>

      <section className="form-section" aria-labelledby="register-sessions">
        <SectionTitle id="register-sessions" required>
          Sessions
        </SectionTitle>
        <div className="check-group">
          {sessions.map(session => (
            <Checkbox key={session.id} name="sessionIds" value={session.id}>
              {session.name}
            </Checkbox>
          ))}
        </div>
        {err('sessionIds') && (
          <span className="field-error" role="alert">
            {err('sessionIds')}
          </span>
        )}
      </section>

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
