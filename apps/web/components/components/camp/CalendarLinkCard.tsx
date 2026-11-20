'use client';

import { useState } from 'react';
import { Button } from '@/components/elements';
import { rotateCalendarTokenAction } from '@/actions/camp';

/**
 * The camp's calendar link. The raw token exists only in this response: the server keeps a hash. The link is shown once, with a copy
 * button, and making a new one stops the old one working at once. Only people with org:update see this card.
 */
export function CalendarLinkCard() {
  const [link, setLink] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function makeLink() {
    setBusy(true);
    setMessage(null);
    const result = await rotateCalendarTokenAction();
    setBusy(false);
    if (!result.ok) {
      setMessage(result.message);

      return;
    }
    setLink(`${window.location.origin}/calendar?token=${encodeURIComponent(result.token)}`);
  }

  async function copy() {
    if (!link) {
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      setMessage('Copied.');
    } catch {
      setMessage('Could not copy. Select the link and copy it by hand.');
    }
  }

  return (
    <section className="panel settings-tile">
      <h2 className="settings-tile-heading">Calendar link</h2>
      <p className="class-helper">
        Calendar apps subscribe to this link. Anyone with it can read the camp&apos;s sessions and classes. Making a new
        link stops the old one at once.
      </p>
      {link ? (
        <>
          <p className="class-helper">Copy it now. It is not shown again.</p>
          <input
            className="calendar-link"
            readOnly
            value={link}
            aria-label="Calendar link"
            onFocus={e => e.currentTarget.select()}
          />
          <div className="classes-actions">
            <Button
              type="button"
              onClick={() => {
                void copy();
              }}
            >
              Copy link
            </Button>
          </div>
        </>
      ) : null}
      {message && <p role="status">{message}</p>}
      <div className="classes-actions">
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            void makeLink();
          }}
          disabled={busy}
        >
          {busy ? 'Making...' : link ? 'Make a new link' : 'Make a calendar link'}
        </Button>
      </div>
    </section>
  );
}
