import { describe, expect, it } from 'vitest';
import { registrationFormForm, registrationSubmissionFromForm } from '../parse';

const SESSION = '3f2b8c1e-5a4d-4b6e-9f70-1a2b3c4d5e6f';
const CAMPER = '7d6c5b4a-3210-4f9e-8d7c-6b5a49382716';

function formOf(entries: Record<string, string | string[]>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(entries)) {
    for (const v of Array.isArray(value) ? value : [value]) {
      form.append(name, v);
    }
  }

  return form;
}

describe('registrationFormForm', () => {
  it('reads a valid form and its questions from the posted JSON', () => {
    const parsed = registrationFormForm(
      formOf({
        name: 'Summer 2027',
        season: '',
        sessionIds: [SESSION],
        fields: JSON.stringify([{ kind: 'yes_no', key: 'photos', label: 'Photo consent', required: true }]),
      }),
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.season).toBeNull();
      expect(parsed.data.fields).toHaveLength(1);
    }
  });

  it('reports unreadable questions against the fields input', () => {
    const parsed = registrationFormForm(formOf({ name: 'Summer', sessionIds: [SESSION], fields: '{not json' }));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.state.status === 'error' && parsed.state.fieldErrors?.fields).toMatch(/could not be read/);
    }
  });

  it('reports a missing session against the sessions input', () => {
    const parsed = registrationFormForm(formOf({ name: 'Summer', fields: '[]' }));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.state.status === 'error' && parsed.state.fieldErrors?.sessionIds).toBeTruthy();
    }
  });
});

describe('registrationSubmissionFromForm', () => {
  it('gathers standard answers by key, custom answers by key, and each child-and-class selection', () => {
    const raw = registrationSubmissionFromForm(
      formOf({
        'standard.camperFirstName': 'Ada',
        'standard.guardianPhone': '555-0100',
        'custom.photos': 'yes',
        selections: [`${CAMPER}|${SESSION}`],
      }),
    );
    expect(raw.selections).toEqual([{ camperId: CAMPER, classId: SESSION }]);
    expect(raw.standard.camperFirstName).toBe('Ada');
    expect(raw.standard.emergencyContactName).toBe('');
    expect(raw.custom).toEqual({ photos: 'yes' });
  });
});
