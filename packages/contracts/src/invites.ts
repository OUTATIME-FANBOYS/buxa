import { z } from 'zod';
import { PersonPhoneSchema } from './contact';
import { RequiredDateOfBirthSchema } from './people';

/**
 * Teacher invites. The phone and the date of birth are required, with the same messages as the person form: the invite is
 * accepted into a person row built from them (buxa_accept_invite), so an invite without either cannot be accepted.
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
  phone: PersonPhoneSchema,
  dateOfBirth: RequiredDateOfBirthSchema,
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
