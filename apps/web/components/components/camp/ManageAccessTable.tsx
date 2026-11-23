'use client';

import { useActionState, useEffect, useState } from 'react';
import type { Member } from '@buxa/contracts';
import { ROLES } from '@buxa/domain';
import { ROLE_LABEL, expiryDay, idle, type ActionState } from '@buxa/shared';
import { changeMemberRoleAction, setMemberExpiryAction } from '@/actions/camp';
import { Button } from '@/components/elements';
import { DatePicker, Select } from '@/components/atoms';
import { useUi } from '@buxa/middleware/providers/UiProvider';
import { firstNameOf } from '@buxa/shared/names';

const ROLE_OPTIONS = ROLES.map(role => ({ value: role, label: ROLE_LABEL[role] }));

/**
 * Manage access: one row per member, with the role they hold now, a Save for a new one, and the day their access ends (optional).
 * Each row saves on its own, so a change to one person never sends the others. The server checks the rules; a refused change
 * shows its message in the row.
 */
export function ManageAccessTable({ members, currentUserId }: { members: readonly Member[]; currentUserId: string }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Role</th>
            <th>Expires on</th>
          </tr>
        </thead>
        <tbody>
          {members.map(member => (
            <MemberRow key={member.id} member={member} isYou={member.id === currentUserId} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MemberRow({ member, isYou }: { member: Member; isYou: boolean }) {
  const [roleState, roleAction, rolePending] = useActionState<ActionState, FormData>(changeMemberRoleAction, idle);
  const [expiryState, expiryAction, expiryPending] = useActionState<ActionState, FormData>(setMemberExpiryAction, idle);
  const { toast } = useUi();
  const [expiresOn, setExpiresOn] = useState<string | null>(member.expiresAt ? expiryDay(member.expiresAt) : null);

  useEffect(() => {
    if (roleState.status === 'success' && roleState.message) {
      toast(roleState.message);
    }
  }, [roleState, toast]);

  useEffect(() => {
    if (expiryState.status === 'success' && expiryState.message) {
      toast(expiryState.message);
    }
  }, [expiryState, toast]);

  // After a save or a clear the page reloads this member's expiry; the field follows it.
  useEffect(() => {
    setExpiresOn(member.expiresAt ? expiryDay(member.expiresAt) : null);
  }, [member.expiresAt]);

  return (
    <tr>
      <td>
        {firstNameOf(member.name)}
        {isYou && <span className="muted"> (you)</span>}
      </td>
      <td>
        <form action={roleAction} className="buxa:flex buxa:flex-wrap buxa:items-center buxa:justify-center buxa:gap-2">
          <input type="hidden" name="userId" value={member.id} />
          <div className="buxa:min-w-[10rem]">
            <Select
              label={`Role for ${firstNameOf(member.name)}`}
              hideLabel
              name="role"
              options={ROLE_OPTIONS}
              defaultValue={member.role}
              isDisabled={isYou || rolePending}
              error={roleState.status === 'error' ? roleState.message : null}
            />
          </div>
          <Button type="submit" variant="primary" size="sm" disabled={isYou || rolePending}>
            {rolePending ? 'Saving…' : 'Save'}
          </Button>
        </form>
      </td>
      <td>
        <div className="buxa:flex buxa:flex-wrap buxa:items-end buxa:justify-center buxa:gap-2">
          <form
            action={expiryAction}
            className="buxa:flex buxa:flex-wrap buxa:items-end buxa:justify-center buxa:gap-2"
          >
            <input type="hidden" name="userId" value={member.id} />
            <input type="hidden" name="intent" value="set" />
            <div className="buxa:min-w-[10rem]">
              <DatePicker
                label={`Access ends for ${firstNameOf(member.name)}`}
                name="expiresOn"
                value={expiresOn}
                onChange={setExpiresOn}
                error={expiryState.status === 'error' ? expiryState.message : null}
                isDisabled={isYou || expiryPending}
              />
            </div>
            <Button type="submit" variant="primary" size="sm" disabled={isYou || expiryPending || !expiresOn}>
              {expiryPending ? 'Saving…' : 'Save expiry'}
            </Button>
          </form>
          <form action={expiryAction}>
            <input type="hidden" name="userId" value={member.id} />
            <input type="hidden" name="intent" value="clear" />
            <Button type="submit" variant="glass" size="sm" disabled={isYou || expiryPending || !member.expiresAt}>
              Clear expiry
            </Button>
          </form>
        </div>
      </td>
    </tr>
  );
}
