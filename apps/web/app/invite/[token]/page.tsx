import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ROUTES } from '@/config/routes';
import { JoinInviteForm } from '@/components/components/invites';
import { getOptionalSession } from '@buxa/server/session/index';
import { loadInvitePage } from '@buxa/server/composers/index.server';
import { invitePath } from '@buxa/shared/invites/invitePath';

export const metadata: Metadata = { title: 'Join the camp' };

const UNUSABLE = 'This invite cannot be used. Ask the camp for a new one.';

/**
 * The teacher's invite link. Outside the camp area. Someone who is not signed in goes to sign in and comes back here. A
 * signed-in person sees the profile form, pre-filled from the invite, and joins the camp as a teacher.
 */
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await getOptionalSession();
  if (!session) {
    redirect(`${ROUTES.signIn}?next=${encodeURIComponent(invitePath(token))}`);
  }
  const state = await loadInvitePage(session, token);

  return (
    <main className="auth">
      <div className="auth-card">
        {state.kind === 'join' ? (
          <>
            <h1>{`Join ${state.orgName} as a teacher`}</h1>
            <p className="muted">Check your details, then join the camp.</p>
            <JoinInviteForm
              token={state.token}
              defaults={{ firstName: state.firstName, lastName: state.lastName, phone: state.phone }}
            />
          </>
        ) : null}
        {state.kind === 'unusable' ? (
          <>
            <h1>This invite cannot be used</h1>
            <p className="muted">{UNUSABLE}</p>
          </>
        ) : null}
        {state.kind === 'wrong-email' ? (
          <>
            <h1>This invite is for another email address.</h1>
            <p className="muted">Sign in with the email address the invite was sent to.</p>
          </>
        ) : null}
        {state.kind === 'already-member' ? (
          <>
            <h1>{`You are already in ${state.orgName}`}</h1>
            <p>
              <Link href={ROUTES.camp}>Go to the camp</Link>
            </p>
          </>
        ) : null}
      </div>
    </main>
  );
}
