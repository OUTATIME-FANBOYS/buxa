import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { can } from '@buxa/domain';
import { PageHeader } from '@/components/components';
import { campContext, isDevOutboxEnabled, loadOutbox } from '@buxa/server/composers/index.server';

export const metadata: Metadata = { title: 'Dev outbox' };

/**
 * The dev outbox: the invite emails this build creates. Nothing is sent. The page exists only when ENABLE_DEV_OUTBOX is 1, and
 * it never shows an invite link: the link is shown once, in the Add a teacher pop-up, when the invite is sent.
 */
export default async function Page() {
  if (!isDevOutboxEnabled()) {
    notFound();
  }
  const context = await campContext();
  if (!can(context.actor, 'members:invite', { orgId: context.actor.orgId, newRole: 'viewer' })) {
    notFound();
  }
  const { campName, items } = await loadOutbox(context);

  return (
    <div className="page">
      <PageHeader
        title="Dev outbox"
        subtitle={`Invite emails for ${campName} that this build created. Nothing is sent. Each link was shown once, when its invite was sent.`}
      />
      {items.length === 0 ? <p className="muted">No pending invites.</p> : null}
      {items.map(item => (
        <article key={item.id} className="buxa:grid buxa:gap-2 buxa:mb-6">
          <h2 className="buxa:text-[length:var(--fs-m)]">{item.subject}</h2>
          <p className="muted">{`To ${item.email}. Sent ${item.createdAt.slice(0, 10)}. Works until ${item.expiresAt.slice(0, 10)}.`}</p>
          <pre className="buxa:whitespace-pre-wrap buxa:font-[inherit] buxa:m-0">{item.body}</pre>
        </article>
      ))}
    </div>
  );
}
