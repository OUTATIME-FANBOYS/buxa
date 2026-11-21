import { z } from 'zod';

/**
 * Teacher invites. The phone is optional: an empty value means none (stored as null). Otherwise it is 3 to 32 characters,
 * the same rule the database applies to a phone.
 */
const PhoneField = z
  .string()
  .trim()
  .max(32, 'Keep the phone number under 32 characters')
  .refine(value => value === '' || value.length >= 3, 'Enter a phone number, or leave it empty');

export const InviteTeacherInputSchema = z.object({
  name: z.string().trim().min(1, 'Enter the teacher’s name').max(120, 'Keep the name under 120 characters'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Enter an email address')
    .max(254, 'Keep the email under 254 characters'),
  phone: PhoneField,
});
export type InviteTeacherInput = z.infer<typeof InviteTeacherInputSchema>;

/** The profile the teacher confirms when joining. Last name and phone are optional. */
export const JoinInviteInputSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'This invite cannot be used.'),
  firstName: z.string().trim().min(1, 'Enter your first name').max(60, 'Keep the first name under 60 characters'),
  lastName: z.string().trim().max(60, 'Keep the last name under 60 characters'),
  phone: PhoneField,
});
export type JoinInviteInput = z.infer<typeof JoinInviteInputSchema>;
