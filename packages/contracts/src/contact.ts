/** Email and phone: the one definition of a usable address or number, shared by every contract and form that takes one. */
import { z } from 'zod';

const MAX_EMAIL = 254;
const MAX_PHONE = 32;
const LOCAL_PART = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const DOMAIN_LABEL = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;
const TLD = /^[A-Za-z]{2,}$/;
/** The emergency contact's phone shape (its own form): digits with optional spaces, brackets, dots or hyphens, a leading +. */
const EMERGENCY_PHONE_SHAPE = /^\+?[0-9(][0-9 ()\-.]*$/;
/** The person form's phone shape: an optional leading +, then digits, spaces, dashes and brackets. */
const PERSON_PHONE_SHAPE = /^\+?[0-9(][0-9() -]*$/;
const PERSON_PHONE_MIN_CHARS = 7;
const PERSON_PHONE_MIN_DIGITS = 7;

/** The message for an email that is not a plausible address (the person form, on the client and on the server). */
export const EMAIL_MESSAGE = 'Enter a valid email address.';
/** The message for a person's phone that is missing, too short or not a phone (the person form, on the client and on the server). */
export const PHONE_NUMBER_MESSAGE = 'Enter a phone number with at least 7 digits.';
/** The emergency contact's phone message. Its form keeps the E.164 rule. */
export const PHONE_MESSAGE = 'Use a valid phone number with 7 to 15 digits.';

/** A plausible address: `local@domain.tld`, a local part of up to 64 characters, labels of letters, digits and hyphens, and a letter-only TLD. */
export function isPlausibleEmail(value: string): boolean {
  if (value.length > MAX_EMAIL) {
    return false;
  }
  const at = value.lastIndexOf('@');
  if (at < 1) {
    return false;
  }
  const local = value.slice(0, at);
  const labels = value.slice(at + 1).split('.');
  if (local.length > 64 || !LOCAL_PART.test(local)) {
    return false;
  }
  if (labels.length < 2 || !labels.every(label => DOMAIN_LABEL.test(label))) {
    return false;
  }

  return TLD.test(labels[labels.length - 1]);
}

/**
 * A phone number for the person form: an optional leading +, then digits, spaces, dashes and brackets. Once spaces and dashes are
 * removed it is 7 to 32 characters and has at least 7 digits. As typed it is at most 32 characters, the database limit.
 */
export function isValidPhone(value: string): boolean {
  if (value.length > MAX_PHONE || !PERSON_PHONE_SHAPE.test(value)) {
    return false;
  }
  const compact = value.replace(/[ -]/g, '');
  const digits = compact.replace(/\D/g, '').length;

  return compact.length >= PERSON_PHONE_MIN_CHARS && compact.length <= MAX_PHONE && digits >= PERSON_PHONE_MIN_DIGITS;
}

/** A plausible phone number for the emergency contact: 7 to 15 digits, with the E.164 shape. */
export function isPlausiblePhone(value: string): boolean {
  if (value.length > MAX_PHONE || !EMERGENCY_PHONE_SHAPE.test(value)) {
    return false;
  }
  const digits = value.replace(/\D/g, '').length;

  return digits >= 7 && digits <= 15;
}

/** Required on the Add person form: a blank or short phone gets the person phone message. */
export const PersonPhoneSchema = z.string().trim().refine(isValidPhone, PHONE_NUMBER_MESSAGE);

/** Optional: an empty value means "none" and becomes undefined. A value that is given must be valid. */
export const OptionalPhoneSchema = z
  .string()
  .trim()
  .refine(v => v === '' || isValidPhone(v), PHONE_NUMBER_MESSAGE)
  .transform(v => (v === '' ? undefined : v))
  .optional();

/** Optional on add: an empty value means "none" and becomes undefined. */
export const OptionalEmailSchema = z
  .string()
  .trim()
  .max(MAX_EMAIL, EMAIL_MESSAGE)
  .refine(v => v === '' || isPlausibleEmail(v), EMAIL_MESSAGE)
  .transform(v => (v === '' ? undefined : v))
  .optional();

/** On edit: an empty value is passed on unchanged (as before); anything else must be plausible. */
export const PatchEmailSchema = z
  .string()
  .trim()
  .max(MAX_EMAIL, EMAIL_MESSAGE)
  .refine(v => v === '' || isPlausibleEmail(v), EMAIL_MESSAGE);
