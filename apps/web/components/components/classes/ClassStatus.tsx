import type { Class } from '@buxa/contracts';
import { Pill } from '@/components/elements';
import type { Tone } from '@buxa/shared';

/** Whether a class has places, is full, or is full with a waitlist. Always a word, never colour alone. */
export function classState(cls: Pick<Class, 'capacity' | 'seatsTaken' | 'waitlisted'>): {
  label: string;
  tone: Tone;
  full: boolean;
} {
  const left = cls.capacity - cls.seatsTaken;
  if (left <= 0) {
    return { label: cls.waitlisted > 0 ? 'Full, with a waitlist' : 'Full', tone: 'warn', full: true };
  }

  return { label: `${left} left`, tone: 'ok', full: false };
}

export function ClassStatus({ cls }: { cls: Pick<Class, 'capacity' | 'seatsTaken' | 'waitlisted'> }) {
  const state = classState(cls);

  return <Pill tone={state.tone}>{state.label}</Pill>;
}
