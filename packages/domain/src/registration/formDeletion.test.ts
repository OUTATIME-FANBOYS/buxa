import { describe, expect, it } from 'vitest';
import { decideFormDeletion, FORM_HAS_REGISTRATIONS_MESSAGE } from './rules';

describe('decideFormDeletion', () => {
  it('allows a form that no registration names', () => {
    expect(decideFormDeletion({ registrationCount: 0 })).toEqual({ allow: true });
  });

  it('refuses a form with one or more registrations, whatever their status', () => {
    // The count covers every registration row for the form: pending, confirmed, withdrawn and archived alike.
    expect(decideFormDeletion({ registrationCount: 1 })).toEqual({ allow: false, reason: 'form_has_registrations' });
    expect(decideFormDeletion({ registrationCount: 4 })).toEqual({ allow: false, reason: 'form_has_registrations' });
  });

  it('gives the sentence the screen shows before the server answers', () => {
    expect(FORM_HAS_REGISTRATIONS_MESSAGE).toBe('This form has registrations, so it cannot be deleted.');
  });
});
