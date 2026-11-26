'use client';

import { useState } from 'react';
import { Button } from '@/components/atoms';
import { revokeDesk } from '@/actions/gate';

/** A device as the list shows it: dates as text, and no token. */
export interface DeviceLine {
  deviceId: string;
  householdName: string;
  issuedOn: string;
  expiresOn: string;
  revoked: boolean;
}

/** The phones that verified for the check-in link, with a revoke for each one still in use. Staff revoke a phone here. */
export function PhonesVerifiedPanel({ devices }: { devices: DeviceLine[] }) {
  const [revokedIds, setRevokedIds] = useState<Set<string>>(() => new Set());
  const [message, setMessage] = useState<string | null>(null);

  async function revoke(deviceId: string) {
    setMessage(null);
    const outcome = await revokeDesk(deviceId);
    if (outcome.kind === 'ok') {
      setRevokedIds(previous => new Set(previous).add(deviceId));
    } else {
      setMessage(outcome.message);
    }
  }

  return (
    <section className="buxa:grid buxa:gap-4" aria-label="Phones verified">
      {devices.length === 0 ? (
        <p className="muted">No phone has verified yet.</p>
      ) : (
        <ul className="buxa:grid buxa:gap-2 buxa:list-none buxa:p-0">
          {devices.map(device => {
            const revoked = device.revoked || revokedIds.has(device.deviceId);

            return (
              <li
                key={device.deviceId}
                className="buxa:flex buxa:flex-wrap buxa:justify-between buxa:gap-3 buxa:items-center"
              >
                <span>
                  {device.householdName}{' '}
                  <span className="muted">
                    · since {device.issuedOn}, until {device.expiresOn}
                  </span>
                </span>
                {revoked ? (
                  <span className="muted">Revoked</span>
                ) : (
                  <Button
                    variant="glass"
                    type="button"
                    onClick={() => {
                      void revoke(device.deviceId);
                    }}
                  >
                    Revoke
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {message ? (
        <p className="muted" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
