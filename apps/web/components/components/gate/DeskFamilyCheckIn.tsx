'use client';

import { useState } from 'react';
import { Button } from '@/components/atoms';
import { checkInFromDesk, requestDeskCode, verifyDeskCode } from '@/actions/gate';
import type { GateChildLine } from '@buxa/shared';
import { FamilyCodeForm } from './FamilyCodeForm';
import { GateChildLines, type ChildCheckResult } from './GateChildLines';

/** The desk's check-in answer, in the words the child lines use. Anything that is not a plain success or a double check-in is a refusal. */
type DeskCheckOutcome = Awaited<ReturnType<typeof checkInFromDesk>>;

function resultOf(outcome: DeskCheckOutcome): ChildCheckResult {
  if (outcome.kind !== 'ok') {
    return 'refused';
  }
  if (outcome.value.ok) {
    return 'ok';
  }

  return outcome.value.reason === 'already_on_site' ? 'already_on_site' : 'refused';
}

/**
 * The desk path: a family without its phone. Staff enter the registration email, the parent reads the code out, staff enter it, and
 * the children booked today appear. Each child is then checked in with the same rules as a check-in by name.
 */
export function DeskFamilyCheckIn() {
  const [lines, setLines] = useState<GateChildLine[] | null>(null);
  // A new key remounts the code form, so the next family starts at the email step.
  const [round, setRound] = useState(0);

  const nextFamily = () => {
    setLines(null);
    setRound(previous => previous + 1);
  };

  if (lines === null) {
    return (
      <section className="buxa:grid buxa:gap-3" aria-label="Check in a family by email">
        <FamilyCodeForm
          key={round}
          intro="The family has no phone to scan with. Ask for their registration email, then read the code out to them."
          requestCode={email => requestDeskCode(email)}
          verifyCode={(email, code) => verifyDeskCode(email, code)}
          onVerified={next => setLines(next)}
        />
      </section>
    );
  }

  return (
    <section className="buxa:grid buxa:gap-3" aria-labelledby="desk-children-heading">
      <h2 id="desk-children-heading" className="buxa:text-[length:var(--fs-l)]">
        Children booked today
      </h2>
      <GateChildLines
        lines={lines}
        checkIn={async child => resultOf(await checkInFromDesk(child.personId, child.sessionId))}
        onDone={() => undefined}
      />
      <Button variant="ghost" type="button" onClick={nextFamily}>
        Next family
      </Button>
    </section>
  );
}
