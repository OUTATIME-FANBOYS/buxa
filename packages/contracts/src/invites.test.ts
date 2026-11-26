import { describe, expect, it } from 'vitest';
import { InviteTeacherInputSchema } from './invites';

const valid = { name: 'Ann Lee', email: 'ann@example.test', phone: '+61 400 000 000', dateOfBirth: '1985-06-15' };

function firstIssue(input: Record<string, string>): { path: string; message: string } | undefined {
  const result = InviteTeacherInputSchema.safeParse(input);
  if (result.success) {
    return undefined;
  }
  const issue = result.error.issues[0];

  return { path: String(issue?.path[0] ?? ''), message: issue?.message ?? '' };
}

describe('InviteTeacherInputSchema: the phone and date of birth are required', () => {
  it('accepts an invite with a name, email, phone and date of birth', () => {
    expect(InviteTeacherInputSchema.safeParse(valid).success).toBe(true);
  });

  it('refuses a blank phone with the person form message', () => {
    expect(firstIssue({ ...valid, phone: '' })).toEqual({
      path: 'phone',
      message: 'Enter a phone number with at least 7 digits.',
    });
  });

  it('refuses a blank date of birth with the person form message', () => {
    expect(firstIssue({ ...valid, dateOfBirth: '' })).toEqual({
      path: 'dateOfBirth',
      message: 'Enter the date of birth.',
    });
  });

  it('refuses a date of birth that is not a real date', () => {
    expect(firstIssue({ ...valid, dateOfBirth: 'soon' })).toEqual({
      path: 'dateOfBirth',
      message: 'Use a real date (YYYY-MM-DD).',
    });
  });
});
