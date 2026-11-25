import { z } from 'zod';

/** A family's email as typed. The shape is checked here; whether it is on file is never said. */
const GateEmailSchema = z
  .string({ error: 'Enter the email address the registration used.' })
  .trim()
  .max(254, 'Enter a shorter email address.')
  .email('Enter a valid email address.');

/** The six-digit code, as typed: digits only. */
const GateCodeSchema = z
  .string({ error: 'Enter the 6-digit code.' })
  .trim()
  .regex(/^\d{6}$/, 'Enter the 6-digit code.');

/** The gate's camp link token, as it appears in the URL: 43 base64url characters. */
const GateTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'This check-in link is not valid.');

/** A family asks for a code on the gate's phone (no sign-in). */
export const GateRequestCodeSchema = z.object({ token: GateTokenSchema, email: GateEmailSchema });
export type GateRequestCodeInput = z.infer<typeof GateRequestCodeSchema>;

/** The family enters the code: the gate issues a device token when it matches. */
export const GateVerifySchema = z.object({ token: GateTokenSchema, email: GateEmailSchema, code: GateCodeSchema });
export type GateVerifyInput = z.infer<typeof GateVerifySchema>;

/** A child is checked in at the gate, for the session they are booked into today. */
export const GateCheckInSchema = z.object({
  personId: z.string().uuid(),
  sessionId: z.string().uuid(),
});
export type GateCheckInInput = z.infer<typeof GateCheckInSchema>;

/** Staff at the desk ask for a code for a family, by its registration email. */
export const DeskRequestCodeSchema = z.object({ email: GateEmailSchema });
export type DeskRequestCodeInput = z.infer<typeof DeskRequestCodeSchema>;

/** Staff at the desk enter the code the parent read out. */
export const DeskVerifySchema = z.object({ email: GateEmailSchema, code: GateCodeSchema });
export type DeskVerifyInput = z.infer<typeof DeskVerifySchema>;

/**
 * The one answer to a code request, whether or not the email is on file. Never change it per case: the answer is the privacy
 * control.
 */
export const GATE_CODE_REQUEST_ANSWER = 'If that email is on file, a code is on its way.';
/** The one answer to a wrong, expired, void or unknown code. */
export const GATE_CODE_REFUSED = 'That code is not right, or it has expired. Ask for a new code.';
