'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/atoms';
import { gatePath, qrPath } from '@buxa/shared';
import { rotateLink } from '@/actions/gate';

/**
 * The camp's check-in link as a QR code, for the camp to print, with the admin's rotate button. The phones that verified are in
 * PhonesVerifiedPanel. The link is shown only to the people who may manage it (the server decides what it sends).
 */
export function GateLinkPanel({ initialToken, canRotate }: { initialToken: string | null; canRotate: boolean }) {
  const [token, setToken] = useState(initialToken);
  const [origin, setOrigin] = useState('');
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

  return (
    <section className="buxa:grid buxa:gap-4" aria-label="Check-in link">
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
    </section>
  );
}
