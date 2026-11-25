'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/atoms';
import { gatePath, qrPath } from '@buxa/shared';
import { revokeDesk, rotateLink } from '@/actions/gate';

/** A device as the list shows it: dates as text, and no token. */
export interface DeviceLine {
  deviceId: string;
  householdName: string;
  issuedOn: string;
  expiresOn: string;
  revoked: boolean;
}

/**
 * The camp's check-in link as a QR code, for the camp to print, with the admin's rotate button and the list of phones that verified.
 * Staff revoke a phone here. The link is shown only to the people who may manage it (the server decides what it sends).
 */
export function GateLinkPanel({
  initialToken,
  canRotate,
  devices,
}: {
  initialToken: string | null;
  canRotate: boolean;
  devices: DeviceLine[];
}) {
  const [token, setToken] = useState(initialToken);
  const [origin, setOrigin] = useState('');
  const [revokedIds, setRevokedIds] = useState<Set<string>>(() => new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const url = token === null || origin === '' ? null : `${origin}${gatePath(token)}`;
  const qr = url === null ? null : qrPath(url);

  async function rotate() {
    setBusy(true);
    setMessage(null);
    const outcome = await rotateLink();
    setBusy(false);
    if (outcome.kind === 'ok') {
      setToken(outcome.value);
      setMessage('The link is new. The old one no longer works. Print the new QR code.');
    } else {
      setMessage(outcome.message);
    }
  }

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
    <section className="buxa:grid buxa:gap-4" aria-labelledby="gate-link-heading">
      <h2 id="gate-link-heading" className="buxa:text-[length:var(--fs-l)]">
        Check-in link
      </h2>
      {token === null ? (
        <p className="muted">
          {canRotate ? 'No check-in link yet. Make one, then print its QR code.' : 'An admin prints the check-in link.'}
        </p>
      ) : (
        <div className="buxa:grid buxa:gap-3 buxa:justify-items-start">
          {qr ? (
            <svg
              role="img"
              aria-label="Check-in QR code"
              viewBox={`0 0 ${qr.size} ${qr.size}`}
              shapeRendering="crispEdges"
              className="buxa:w-48 buxa:h-48"
            >
              <rect width={qr.size} height={qr.size} fill="#fff" />
              <path d={qr.d} fill="#000" />
            </svg>
          ) : null}
          <p className="buxa:break-all">
            <span className="muted">Link: </span>
            {url ?? gatePath(token)}
          </p>
        </div>
      )}
      {canRotate ? (
        <Button
          variant="glass"
          type="button"
          icon="check"
          disabled={busy}
          onClick={() => {
            void rotate();
          }}
        >
          {token === null ? 'Make the check-in link' : 'Replace the link'}
        </Button>
      ) : null}
      {message ? (
        <p className="muted" role="status">
          {message}
        </p>
      ) : null}
      <h3 className="buxa:text-[length:var(--fs-m)]">Phones verified</h3>
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
    </section>
  );
}
