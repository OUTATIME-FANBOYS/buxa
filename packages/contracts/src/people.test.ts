import { describe, expect, it } from 'vitest';
import { PersonPatchInputSchema } from './people';

describe('PersonPatchInputSchema phone', () => {
  it('turns a blank phone into null, so the edit clears it instead of storing an empty string', () => {
    const parsed = PersonPatchInputSchema.parse({ phone: '' });
    expect(parsed.phone).toBeNull();
  });

  it('keeps a valid phone as typed', () => {
    expect(PersonPatchInputSchema.parse({ phone: '+1 321 438 2934' }).phone).toBe('+1 321 438 2934');
  });

  it('refuses a phone that is given but not plausible', () => {
    expect(PersonPatchInputSchema.safeParse({ phone: '12' }).success).toBe(false);
  });
});
