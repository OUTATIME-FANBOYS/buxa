import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { GateScreen } from '@/components/components/gate';
import { loadGateStatus } from '@buxa/server/composers/index.server';
import { GATE_DEVICE_COOKIE } from '@buxa/shared';

export const metadata: Metadata = { title: 'Check-in' };

/**
 * The camp's check-in link, opened on a family's phone. Outside the camp area and without sign-in. An unknown link says so; a phone
 * with no verified device sees the email step; a verified phone sees its children booked today.
 */
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const deviceToken = (await cookies()).get(GATE_DEVICE_COOKIE)?.value;
  const status = await loadGateStatus({ token, deviceToken });

  if (status.kind === 'invalid') {
    return (
      <main className="auth">
        <div className="auth-card">
          <h1>This check-in link is not valid</h1>
          <p className="muted">Ask the camp for its check-in link.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="auth">
      <div className="auth-card">
        <h1>{`Check in at ${status.campName}`}</h1>
        <GateScreen
          token={token}
          state={status.kind === 'device' ? { kind: 'device', children: status.children } : { kind: 'no-device' }}
        />
      </div>
    </main>
  );
}
