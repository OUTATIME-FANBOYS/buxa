'use server';
import {
  createTeacherInviteAction as createTeacherInviteActionImpl,
  resendTeacherInviteAction as resendTeacherInviteActionImpl,
} from '@buxa/server/composers/invites/inviteActions';
import { joinInviteAction as joinInviteActionImpl } from '@buxa/server/composers/invites/joinInviteAction';

// Server action wrappers for the teacher invites. Client components import this module, never @buxa/server.

export async function createTeacherInviteAction(...args: Parameters<typeof createTeacherInviteActionImpl>) {
  return createTeacherInviteActionImpl(...args);
}

export async function resendTeacherInviteAction(...args: Parameters<typeof resendTeacherInviteActionImpl>) {
  return resendTeacherInviteActionImpl(...args);
}

export async function joinInviteAction(...args: Parameters<typeof joinInviteActionImpl>) {
  return joinInviteActionImpl(...args);
}
