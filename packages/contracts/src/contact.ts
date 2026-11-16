/** Email and phone: the one definition of a usable address or number, shared by every contract that takes one. */
import { z } from 'zod';

const MAX_EMAIL = 254;
const MAX_PHONE = 32;
const LOCAL_PART = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const DOMAIN_LABEL = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;
const TLD = /^[A-Za-z]{2,}$/;
const PHONE_SHAPE = /^\+?[0-9(][0-9 ()\-.]*$/;

/** A plausible address: `local@domain.tld`, a local part of up to 64 characters, labels of letters, digits and hyphens, and a letter-only TLD. */
export function isPlausibleEmail(value: string): boolean {
  if (value.length > MAX_EMAIL) return false;
  const at = value.lastIndexOf('@');
  if (at < 1) return false;
  const local = value.slice(0, at);
  const labels = value.slice(at + 1).split('.');
  if (local.length > 64 || !LOCAL_PART.test(local)) return false;
  if (labels.length < 2 || !labels.every(label => DOMAIN_LABEL.test(label))) return false;
  return TLD.test(labels[labels.length - 1]);
}

/** A plausible phone number: digits with optional spaces, brackets, dots or hyphens, an optional leading +, and 7 to 15 digits (E.164). */
export function isPlausiblePhone(value: string): boolean {
  if (value.length > MAX_PHONE || !PHONE_SHAPE.test(value)) return false;
  const digits = value.replace(/\D/g, '').length;
  return digits >= 7 && digits <= 15;
}

const EMAIL_MESSAGE = 'Use a valid email address, for example name@example.com.';
const PHONE_MESSAGE = 'Use a valid phone number with 7 to 15 digits.';

/** Optional on create: an empty value means "none" and becomes undefined. */
export const OptionalEmailSchema = z.string().trim().max(MAX_EMAIL)
  .refine(v => v === '' || isPlausibleEmail(v), EMAIL_MESSAGE)
  .transform(v => (v === '' ? undefined : v)).optional();
export const OptionalPhoneSchema = z.string().trim().max(MAX_PHONE)
  .refine(v => v === '' || isPlausiblePhone(v), PHONE_MESSAGE)
  .transform(v => (v === '' ? undefined : v)).optional();

/** On patch: an empty value is passed on unchanged (as before); anything else must be plausible. */
export const PatchEmailSchema = z.string().trim().max(MAX_EMAIL).refine(v => v === '' || isPlausibleEmail(v), EMAIL_MESSAGE);
export const PatchPhoneSchema = z.string().trim().max(MAX_PHONE).refine(v => v === '' || isPlausiblePhone(v), PHONE_MESSAGE);
