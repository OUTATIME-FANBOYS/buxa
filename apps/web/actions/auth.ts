'use server';
import { signIn as signInImpl } from '@buxa/server/composers/auth/signIn';
import { signUp as signUpImpl } from '@buxa/server/composers/auth/signUp';
import { signOut as signOutImpl } from '@buxa/server/composers/auth/signOut';
import { settle } from '@buxa/domain';

// Server action wrappers for the auth screens. Client components import this module, never @buxa/server. Next.js allows only
// async functions to be exported from a 'use server' file, so each action is wrapped rather than re-exported.

export function signIn(...args: Parameters<typeof signInImpl>) {
  return settle(() => {
    return signInImpl(...args);
  });
}

export function signUp(...args: Parameters<typeof signUpImpl>) {
  return settle(() => {
    return signUpImpl(...args);
  });
}

export function signOut(...args: Parameters<typeof signOutImpl>) {
  return settle(() => {
    return signOutImpl(...args);
  });
}
