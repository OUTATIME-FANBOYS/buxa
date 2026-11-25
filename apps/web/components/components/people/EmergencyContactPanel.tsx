'use client';

import { useCallback, useState } from 'react';
import type { Person } from '@buxa/contracts';
import { emergencyContactComplete } from '@buxa/domain';
import { Button, Pill } from '@/components/elements';
import { EmergencyContactForm } from '@/components/components/people/forms';

/**
 * The person's emergency contact, on every profile. Optional, so a missing contact is only a muted note, and only for a camper.
 * `emergencyContact` is null for a viewer who may not see it (staff and the family's guardian can). Edit is offered only when the
 * server says this viewer may change it (`canEditEmergencyContact`).
 */
export function EmergencyContactPanel({
  person,
  embedded = false,
}: {
  person: Pick<Person, 'id' | 'roles' | 'emergencyContact' | 'canEditEmergencyContact'>;
  /** Inside the household card (families): a tag heading instead of its own card. */
  embedded?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const finish = useCallback(() => setEditing(false), []);
  const contact = person.emergencyContact;
  const isCamper = person.roles.includes('camper');

  const Wrapper = embedded ? 'div' : 'section';
  const heading = embedded ? (
    <Pill tone="neutral">Emergency contact</Pill>
  ) : (
    <h2 id="emergency-contact-heading" className="people-heading">
      Emergency contact
    </h2>
  );

  return (
    <Wrapper
      className={embedded ? 'stack people-subpanel' : 'panel'}
      aria-labelledby={embedded ? undefined : 'emergency-contact-heading'}
    >
      <div className="buxa:flex buxa:flex-wrap buxa:items-center buxa:justify-between buxa:gap-2">
        {heading}
        {person.canEditEmergencyContact && contact !== null && !editing && (
          <Button size="sm" icon="edit" onClick={() => setEditing(true)}>
            {contact.name === null ? 'Add' : 'Edit'}
          </Button>
        )}
      </div>

      {contact === null ? (
        <p className="muted">Shown to staff and the family&apos;s guardian only.</p>
      ) : editing ? (
        <EmergencyContactForm personId={person.id} contact={contact} onDone={finish} />
      ) : (
        <EmergencyContactView contact={contact} isCamper={isCamper} complete={emergencyContactComplete(person)} />
      )}
    </Wrapper>
  );
}

function EmergencyContactView({
  contact,
  isCamper,
  complete,
}: {
  contact: NonNullable<Person['emergencyContact']>;
  isCamper: boolean;
  complete: boolean;
}) {
  const rows = [
    { label: 'Name', value: contact.name },
    { label: 'Phone', value: contact.phone },
    { label: 'Relationship', value: contact.relationship },
  ].filter((row): row is { label: string; value: string } => row.value !== null && row.value !== '');

  return (
    <>
      {rows.length > 0 && (
        <dl className="people-facts">
          {rows.map(row => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {!complete && isCamper && <p className="muted">Emergency contact is missing</p>}
      {!complete && !isCamper && rows.length === 0 && <p className="muted">No emergency contact recorded.</p>}
    </>
  );
}
