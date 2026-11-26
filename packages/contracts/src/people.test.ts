import { describe, expect, it } from 'vitest';
import { PHONE_NUMBER_MESSAGE } from './contact';
import { PersonPatchInputSchema } from './people';

describe('PersonPatchInputSchema: date of birth and phone are required on edit', () => {
  it('refuses a blank phone, so the edit cannot clear it', () => {
    const result = PersonPatchInputSchema.safeParse({ phone: '' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(PHONE_NUMBER_MESSAGE);
  });

  it('refuses a blank date of birth', () => {
    expect(PersonPatchInputSchema.safeParse({ dateOfBirth: '' }).success).toBe(false);
  });

  it('accepts a valid phone and date as typed', () => {
    const parsed = PersonPatchInputSchema.parse({ phone: '+1 321 438 2934', dateOfBirth: '1985-06-15' });
    expect(parsed).toEqual({ phone: '+1 321 438 2934', dateOfBirth: '1985-06-15' });
  });

  it('leaves both out when the form does not post them', () => {
    expect(PersonPatchInputSchema.parse({ givenName: 'Ada' })).toEqual({ givenName: 'Ada' });
  });
});
