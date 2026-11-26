-- 0073: an emergency contact on every person (v0.4, docs/phases/03-registration.md, "Emergency contact on the person").
--
-- Optional for everyone, and not required anywhere yet: it becomes a check only when a profile is activated (not built). Three
-- nullable text columns on people. Existing rows get no contact; nothing is backfilled.
--
-- The name and the phone go together, so a contact is either both there or both missing. The relationship is kept only with a name.
-- The phone is checked for a plausible length here (7 to 32 characters, the same range as the phone field); its shape is checked in
-- packages/contracts (contact.ts). The request role already has SELECT, INSERT and UPDATE on people (migration 0007), so no grant
-- is added. Writes go through the people service and are audited as person.emergency_contact.update.

ALTER TABLE people
  ADD COLUMN emergency_contact_name         text,
  ADD COLUMN emergency_contact_phone        text,
  ADD COLUMN emergency_contact_relationship text,
  ADD CONSTRAINT people_emergency_contact_name_length
    CHECK (emergency_contact_name IS NULL OR length(btrim(emergency_contact_name)) BETWEEN 1 AND 120),
  ADD CONSTRAINT people_emergency_contact_phone_length
    CHECK (emergency_contact_phone IS NULL OR length(btrim(emergency_contact_phone)) BETWEEN 7 AND 32),
  ADD CONSTRAINT people_emergency_contact_relationship_length
    CHECK (emergency_contact_relationship IS NULL OR length(btrim(emergency_contact_relationship)) BETWEEN 1 AND 40),
  ADD CONSTRAINT people_emergency_contact_name_phone_pair
    CHECK ((emergency_contact_name IS NULL) = (emergency_contact_phone IS NULL)),
  ADD CONSTRAINT people_emergency_contact_relationship_needs_name
    CHECK (emergency_contact_relationship IS NULL OR emergency_contact_name IS NOT NULL);
