'use server';
import { signIn as signInImpl } from '@buxa/server/composers/auth/signIn';
import { signUp as signUpImpl } from '@buxa/server/composers/auth/signUp';
import { signOut as signOutImpl } from '@buxa/server/composers/auth/signOut';

// Server action wrappers for the auth screens. Client components import this module, never @buxa/server. Next.js allows only
// async functions to be exported from a 'use server' file, so each action is wrapped rather than re-exported.

export async function signIn(...args: Parameters<typeof signInImpl>) {
  return signInImpl(...args);
}

export async function signUp(...args: Parameters<typeof signUpImpl>) {
  return signUpImpl(...args);
}

export async function signOut(...args: Parameters<typeof signOutImpl>) {
  return signOutImpl(...args);
}
