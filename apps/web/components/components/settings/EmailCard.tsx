'use client';

import { TextField } from '@/components/atoms';

/**
 * Email: shown in an input that cannot be edited. It comes from the sign-in, so there is no button to change it.
 */
export function EmailCard({ email, className }: { email: string; className?: string }) {
  return (
    <section className={`panel settings-tile ${className ?? ''}`} aria-labelledby="email-title">
      <h2 id="email-title">Email</h2>
      <TextField label="Email" hideLabel value={email} onChange={() => undefined} isDisabled />
    </section>
  );
}
