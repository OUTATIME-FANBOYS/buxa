-- Changing a camp's name or time zone is for an admin or the owner. The app checked this (org:update) but the row policy
-- let any member update the row, so a staff member who reached the database through the app could change it. The policy now
-- requires the signed-in user's role to be admin or owner. A non-member is NULL, which the policy refuses.

ALTER POLICY orgs_update ON orgs
  USING (id = current_org() AND is_member(id) IN ('admin', 'owner'))
  WITH CHECK (id = current_org() AND is_member(id) IN ('admin', 'owner'));
