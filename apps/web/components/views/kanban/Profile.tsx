'use client';

import type { User } from '@buxa/contracts';
import { useStore } from '@buxa/middleware/providers/providers';
import { useUi } from '@buxa/middleware/providers/UiProvider';
import {
  AppearanceCard,
  DisplayNameCard,
  EmailCard,
  TimeFormatCard,
  SETTINGS_GRID,
} from '@/components/components/settings';
import { fullNameOf } from '@buxa/shared/names';

/**
 * The signed-in person's profile: display name, email, time format and appearance. It belongs to the account, not a camp,
 * so it opens with or without one. The name is saved to the account first; only then does the board's own copy change.
 */
export function Profile({ user }: { user: User }) {
  const { actions, me } = useStore();
  const { toast } = useUi();

  const savedName = (saved: { firstName: string; lastName: string | null }) => {
    actions.updateProfile({ name: fullNameOf(saved.firstName, saved.lastName), title: me?.title });
    toast('Profile saved');
  };

  return (
    <div className="page settings-page buxa:max-w-none!">
      <header className="page-head">
        <div className="page-title">
          <h1>Profile</h1>
        </div>
      </header>
      <div className={`settings-grid ${SETTINGS_GRID}`}>
        <DisplayNameCard firstName={user.firstName} lastName={user.lastName} onSaved={savedName} />
        <EmailCard email={user.email} />
        <TimeFormatCard clockFormat={user.clockFormat ?? undefined} />
        <AppearanceCard />
      </div>
    </div>
  );
}
