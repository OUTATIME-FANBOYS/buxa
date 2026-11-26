'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { checkInAtGate, requestGateCode, verifyGateCode } from '@/actions/gate';
import type { GateChildLine } from '@buxa/shared';
import { FamilyCodeForm } from './FamilyCodeForm';
import { GateChildLines, type ChildCheckResult } from './GateChildLines';

/** What the phone's server page found: a phone that must verify, or one whose device is verified, with its children. */
export type GatePhoneState = { kind: 'no-device' } | { kind: 'device'; children: GateChildLine[] };

const toCheckResult = (outcome: Awaited<ReturnType<typeof checkInAtGate>>): ChildCheckResult => {
  if (outcome.kind !== 'ok') {
    return 'refused';
  }

  return outcome.value;
};

/**
 * The gate on a phone: the email and code step while the phone has no device token, then the children booked today. A verified code
 * refreshes the page, so the server reads the new cookie and lists the children.
 */
export function GateScreen({ token, state }: { token: string; state: GatePhoneState }) {
  const router = useRouter();
  const refresh = useCallback(() => router.refresh(), [router]);

  if (state.kind === 'no-device') {
    return (
      <FamilyCodeForm
        intro="Check your children in. First, confirm it is you."
        requestCode={email => requestGateCode(token, email)}
        verifyCode={(email, code) => verifyGateCode(token, email, code)}
        onVerified={refresh}
      />
    );
  }

  return (
    <div className="buxa:grid buxa:gap-4">
      <p className="muted">Tick the children who are here, then check them in.</p>
      <GateChildLines
        lines={state.children}
        checkIn={async child => toCheckResult(await checkInAtGate(token, child.personId, child.sessionId))}
        onDone={refresh}
      />
    </div>
  );
}
