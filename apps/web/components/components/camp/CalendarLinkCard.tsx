'use client';

import { useState } from 'react';
import { Button } from '@/components/elements';
import { rotateCalendarTokenAction, rotateOwnCalendarTokenAction } from '@/actions/camp';

/**
 * A calendar link. The raw token exists only in this response: the server keeps a hash. The link is shown once, in a field
 * with two icon buttons at its right edge: copy, and make a new link (which stops the old one working at once). Before a link
 * exists, the one action is a primary button. The camp link (org:update) covers every session; a teacher's own link (`own`)
 * covers only the classes that teacher is assigned to.
 */
export function CalendarLinkCard({ own = false }: { own?: boolean }) {
  const [link, setLink] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function makeLink() {
    setBusy(true);
    setMessage(null);
    const result = own ? await rotateOwnCalendarTokenAction() : await rotateCalendarTokenAction();
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
      <h2 className="settings-tile-heading">{own ? 'Your calendar link' : 'Calendar link'}</h2>
      <p className="class-helper">
        {own
          ? 'Calendar apps subscribe to this link. Anyone with it can read the classes you are assigned to. Making a new link stops the old one at once.'
          : 'Calendar apps subscribe to this link. Anyone with it can read the camp’s sessions and classes. Making a new link stops the old one at once.'}
      </p>
      {link ? (
        <>
          <p className="class-helper">Copy it now. It is not shown again.</p>
          <div className="calendar-link">
            <input
              className="calendar-link__input"
              readOnly
              value={link}
              aria-label="Calendar link"
              onFocus={e => e.currentTarget.select()}
            />
            <div className="calendar-link__actions">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                iconOnly
                icon="copy"
                aria-label="Copy link"
                onClick={() => {
                  void copy();
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                iconOnly
                icon="refresh"
                aria-label="Make a new link"
                disabled={busy}
                onClick={() => {
                  void makeLink();
                }}
              />
            </div>
          </div>
        </>
      ) : (
        <div className="classes-actions">
          <Button
            type="button"
            variant="primary"
            disabled={busy}
            onClick={() => {
              void makeLink();
            }}
          >
            {busy ? 'Making...' : 'Make a calendar link'}
          </Button>
        </div>
      )}
      {message && (
        <p className="class-helper" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
