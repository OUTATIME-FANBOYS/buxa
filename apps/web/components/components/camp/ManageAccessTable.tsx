'use client';

import { useActionState, useEffect } from 'react';
import type { Member } from '@buxa/contracts';
import { ROLES } from '@buxa/domain';
import { ROLE_LABEL, idle, type ActionState } from '@buxa/shared';
import { changeMemberRoleAction } from '@/actions/camp';
import { Button } from '@/components/elements';
import { Select } from '@/components/atoms';
import { useUi } from '@buxa/middleware/providers/UiProvider';
import { firstNameOf } from '@buxa/shared/names';

const ROLE_OPTIONS = ROLES.map(role => ({ value: role, label: ROLE_LABEL[role] }));

/**
 * Manage access: one row per member, with the role they hold now and a Save for a new one. Each row saves on its own, so a
 * change to one person never sends the others. The server checks the rules; a refused change shows its message in the row.
 */
export function ManageAccessTable({ members, currentUserId }: { members: readonly Member[]; currentUserId: string }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Role</th>
            <th>
              <span className="buxa:sr-only">Save</span>
            </th>
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
  const [state, formAction, pending] = useActionState<ActionState, FormData>(changeMemberRoleAction, idle);
  const { toast } = useUi();

  useEffect(() => {
    if (state.status === 'success' && state.message) {
      toast(state.message);
    }
  }, [state, toast]);

  return (
    <tr>
      <td>
        {firstNameOf(member.name)}
        {isYou && <span className="muted"> (you)</span>}
      </td>
      <td>
        <form action={formAction} className="buxa:flex buxa:flex-wrap buxa:items-center buxa:justify-center buxa:gap-2">
          <input type="hidden" name="userId" value={member.id} />
          <div className="buxa:min-w-[10rem]">
            <Select
              label={`Role for ${firstNameOf(member.name)}`}
              hideLabel
              name="role"
              options={ROLE_OPTIONS}
              defaultValue={member.role}
              isDisabled={isYou || pending}
              error={state.status === 'error' ? state.message : null}
            />
          </div>
          <Button type="submit" variant="primary" size="sm" disabled={isYou || pending}>
            {pending ? 'Saving…' : 'Save'}
          </Button>
        </form>
      </td>
    </tr>
  );
}
