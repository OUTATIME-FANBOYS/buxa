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

export function RegisterForm({
  formId,
  sessions,
  fields,
}: {
  formId: string;
  sessions: readonly { id: string; name: string }[];
  fields: readonly CustomField[];
}) {
  const [state, formAction, pending] = useActionState(submitRegistrationAction, idle);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === 'error' && state.fieldErrors) {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  }, [state]);

  const err = (name: string) => fieldError(state, name);
  const label = (text: string, required: boolean) => (required ? `${text} *` : text);

  return (
    <form ref={formRef} action={formAction} className="class-form registration-register">
      <input type="hidden" name="formId" value={formId} />
      <p className="muted">Fields marked with an asterisk are required. Nothing is charged here.</p>

      <fieldset className="registration-group">
        <legend className="registration-group__title">Sessions *</legend>
        {sessions.map(session => (
          <Checkbox key={session.id} name="sessionIds" value={session.id}>
            {session.name}
          </Checkbox>
        ))}
        {err('sessionIds') && (
          <span className="field-error buxa:text-[length:var(--fs-s)] buxa:text-[var(--crit)]" role="alert">
            {err('sessionIds')}
          </span>
        )}
      </fieldset>

      {GROUPS.map(group => (
        <fieldset key={group.title} className="registration-group">
          <legend className="registration-group__title">{group.title}</legend>
          {group.keys.map(key => {
            const name = `standard.${key}`;
            const required = REQUIRED.get(key) ?? false;
            const text = label(group.labels[key] ?? key, required);
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
        </fieldset>
      ))}

      {fields.length > 0 && (
        <fieldset className="registration-group">
          <legend className="registration-group__title">Questions</legend>
          {fields.map(field => {
            const name = `custom.${field.key}`;
            const text = label(field.label, field.required);
            const error = err(name);
            if (field.kind === 'text') {
              return (
                <TextField
                  key={field.key}
                  label={text}
                  name={name}
                  error={error}
                  isRequired={field.required}
                  maxLength={2000}
                  autoComplete="off"
                />
              );
            }
            if (field.kind === 'date') {
              return <DatePicker key={field.key} label={text} name={name} error={error} isRequired={field.required} />;
            }
            if (field.kind === 'yes_no') {
              return (
                <RadioGroup
                  key={field.key}
                  label={text}
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
                label={text}
                name={name}
                options={options}
                error={error}
                isRequired={field.required}
              />
            ) : (
              <Select
                key={field.key}
                label={text}
                name={name}
                options={options}
                error={error}
                isRequired={field.required}
                placeholder="Choose"
              />
            );
          })}
        </fieldset>
      )}

      <ActionMessage state={state} />
      <div className="classes-actions">
        <Button type="submit" variant="primary" disabled={pending} className="classes-target">
          {pending ? 'Recording...' : 'Record registration'}
        </Button>
        <Button variant="ghost" className="classes-target" href={registrationFormPath(formId)}>
          Back to the form
        </Button>
      </div>
    </form>
  );
}
