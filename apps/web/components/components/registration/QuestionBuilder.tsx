'use client';

import { useState } from 'react';
import type { CustomField, FieldKind } from '@buxa/contracts';
import { Button, Checkbox, Select, TextField } from '@/components/elements';

/*
 * The camp's own questions for a form: a plain list, one line each, and a single place to add the next one. The list posts as JSON
 * in the hidden `fields` input; the server checks it with the contract, so nothing here is trusted.
 */

const KIND_LABEL: Record<FieldKind, string> = {
  text: 'Text',
  choice: 'Choice',
  date: 'Date',
  yes_no: 'Yes or no',
};

const KIND_OPTIONS = (Object.keys(KIND_LABEL) as FieldKind[]).map(kind => ({ value: kind, label: KIND_LABEL[kind] }));

/** A key the server accepts (lowercase, starts with a letter), unique within the form. Derived from the label. */
export function keyFromLabel(label: string, taken: readonly string[]): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 36) || 'question';
  const start = /^[a-z]/.test(base) ? base : `q_${base}`;
  let key = start;
  for (let n = 2; taken.includes(key); n++) {
    key = `${start}_${n}`;
  }

  return key;
}

function describe(field: CustomField): string {
  const parts = [KIND_LABEL[field.kind], field.required ? 'Required' : 'Optional'];
  if (field.kind === 'choice') {
    parts.push(field.options.join(', '));
  }

  return parts.join(' · ');
}

export function QuestionBuilder({ initial = [] }: { initial?: CustomField[] }) {
  const [fields, setFields] = useState<CustomField[]>(initial);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<FieldKind>('text');
  const [required, setRequired] = useState(false);
  const [optionsText, setOptionsText] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const options = optionsText
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

  const reset = () => {
    setAdding(false);
    setLabel('');
    setKind('text');
    setRequired(false);
    setOptionsText('');
    setProblem(null);
  };

  const add = () => {
    if (label.trim() === '') {
      setProblem('Enter a label.');

      return;
    }
    if (kind === 'choice' && options.length < 2) {
      setProblem('A choice question needs at least two options, separated by commas.');

      return;
    }
    const key = keyFromLabel(
      label.trim(),
      fields.map(f => f.key),
    );
    const base = { key, label: label.trim(), required };
    const next: CustomField = kind === 'choice' ? { ...base, kind, options } : { ...base, kind };
    setFields([...fields, next]);
    reset();
  };

  return (
    <div className="question-builder">
      <input type="hidden" name="fields" value={JSON.stringify(fields)} />
      {fields.length === 0 ? (
        <p className="muted question-builder__empty">
          No questions of your own yet. The standard questions are always asked.
        </p>
      ) : (
        <ol className="question-list">
          {fields.map(field => (
            <li key={field.key} className="question-list__item">
              <span className="question-list__text">
                <strong>{field.label}</strong>
                <span className="muted">{describe(field)}</span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                type="button"
                icon="x"
                aria-label={`Remove ${field.label}`}
                onClick={() => setFields(fields.filter(f => f.key !== field.key))}
              />
            </li>
          ))}
        </ol>
      )}

      {adding ? (
        <div className="question-add">
          <TextField
            label="Question"
            value={label}
            onChange={value => {
              setLabel(value);
              setProblem(null);
            }}
            maxLength={120}
            error={problem}
            autoFocus
          />
          <div className="question-add__row">
            <Select
              label="Answer type"
              options={KIND_OPTIONS}
              value={kind}
              onChange={value => setKind((value ?? 'text') as FieldKind)}
            />
            <Checkbox isSelected={required} onChange={setRequired}>
              Required
            </Checkbox>
          </div>
          {kind === 'choice' && (
            <TextField
              label="Choices"
              value={optionsText}
              onChange={setOptionsText}
              hint="Separate the choices with commas, for example None, Beginner, Strong."
            />
          )}
          <div className="classes-actions">
            <Button variant="primary" type="button" onClick={add}>
              Add question
            </Button>
            <Button variant="glass" type="button" onClick={reset}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="glass" type="button" icon="plus" onClick={() => setAdding(true)}>
          Add a question
        </Button>
      )}
    </div>
  );
}
