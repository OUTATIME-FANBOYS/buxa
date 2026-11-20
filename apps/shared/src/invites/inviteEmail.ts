/**
 * The onboarding email for a teacher invite. In this build it is never sent: the dev outbox lists it, and the invite link is
 * shown once in the Add a teacher pop-up. The text is the same whether it is shown or sent later.
 */
export interface TeacherInviteEmail {
  subject: string;
  body: string;
}

/** The link placeholder used where the real link is not kept (the outbox lists the message without it). */
export const LINK_NOT_KEPT = '[link shown once, in the Add a teacher pop-up, when the invite was sent]';

export function teacherInviteEmail({
  camp,
  firstName,
  link,
  expiresOn,
}: {
  camp: string;
  firstName: string;
  link: string;
  expiresOn: string;
}): TeacherInviteEmail {
  return {
    subject: `You are invited to teach at ${camp}`,
    body: [
      `Hello ${firstName},`,
      '',
      `${camp} has invited you to join as a teacher. Open the link below, sign in or create an account with this email address, confirm your details, and join the camp.`,
      '',
      link,
      '',
      `The link works until ${expiresOn}.`,
    ].join('\n'),
  };
}
