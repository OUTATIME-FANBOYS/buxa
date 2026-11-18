'use client';

import { useRef, useState } from 'react';
import type { User } from '@buxa/contracts';
import { useStore } from '@buxa/middleware/providers/providers';
import { Button } from '@/components/elements';
import { useUi } from '@buxa/middleware/providers/UiProvider';
import { ROUTES } from '@/config/routes';
import { AgentDialog } from '@/components/components/kanban/dialogs';
import { ResetDemoButton } from '@/components/components/kanban';
import { AppearanceCard, NameEmailCard, TimeFormatCard } from '@/components/components/settings';
import { ArchivedCampsCard, DangerZone } from '@/components/components/camp';
import type { ArchivedCamp } from '@/actions/camp';
import { fullNameOf } from '@buxa/shared/names';

/** The camp the settings are for. `canDelete` is the owner's right (org:delete); an archived camp shows no danger zone. */
export interface SettingsCamp {
  id: string;
  name: string;
  canDelete: boolean;
  archived: boolean;
}

/**
 * Settings is one grid of cards. The first three are the person's own: Name and email (full width), then Time format and
 * Appearance side by side. They are followed by the Agents, data and shortcut cards, then archived camps and the danger zone.
 * On a phone every card stacks.
 */
export function Settings({
  camp,
  user,
  archivedCamps = [],
}: {
  camp?: SettingsCamp;
  user?: User;
  archivedCamps?: readonly ArchivedCamp[];
}) {
  const { s, actions, me, readOnly } = useStore();
  const { toast } = useUi();
  const file = useRef<HTMLInputElement>(null);
  const [addAgent, setAddAgent] = useState(false);
  const on = s.ui.agentsEnabled;
  const hasAgents = s.agents.length > 0;
  const firstName = user?.firstName ?? me?.name.split(' ')[0] ?? '';
  const lastName = user?.lastName ?? null;
  const email = user?.email ?? me?.email ?? '';

  // The name is saved to the signed-in account first: the greeting, the account menu and the team list read it from there.
  // Only then does the board's own copy change, so it never shows a name the account does not have.
  const savedName = (saved: { firstName: string; lastName: string | null }) => {
    actions.updateProfile({ name: fullNameOf(saved.firstName, saved.lastName), title: me?.title });
    toast('Profile saved');
  };
  const exportJson = () => {
    const url = URL.createObjectURL(new Blob([actions.exportData()], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `buxa-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page settings-page">
      <header className="page-head">
        <div className="page-title">
          <h1>Settings</h1>
        </div>
      </header>
      <div className="settings-grid">
        <NameEmailCard
          className="settings-tile--full"
          firstName={firstName}
          lastName={lastName}
          email={email}
          onSaved={savedName}
        />
        <TimeFormatCard className="settings-tile--half" clockFormat={user?.clockFormat ?? undefined} />
        <AppearanceCard className="settings-tile--half" />
        <section className="panel settings-tile">
          <h2>Agents</h2>
          <p className="muted">
            Let AI agents add and update tasks on your boards. Their changes can wait for your approval, and every one
            is recorded. Leave this off and Buxa is a plain Kanban board.
          </p>
          <label className="check-row">
            <input type="checkbox" checked={on} onChange={e => actions.setAgentsEnabled(e.target.checked)} />
            <span>Turn on agents</span>
          </label>
          {on && (
            <div className="row">
              {!readOnly && <Button onClick={() => setAddAgent(true)}>Add an agent</Button>}
              {hasAgents && (
                <Button variant="ghost" href={ROUTES.agents}>
                  Open Agents
                </Button>
              )}
            </div>
          )}
          {addAgent && <AgentDialog onClose={() => setAddAgent(false)} />}
        </section>
        <section className="panel settings-tile">
          <h2>Your data</h2>
          <p className="muted">
            Everything lives in this browser’s storage. Export a copy to back it up or move it to another device.
          </p>
          <div className="row">
            <Button onClick={exportJson}>Export JSON</Button>
            {!readOnly && (
              <>
                <Button onClick={() => file.current?.click()}>Import JSON</Button>
                <input
                  ref={file}
                  type="file"
                  accept="application/json"
                  hidden
                  onChange={e =>
                    void (async () => {
                      const f = e.target.files?.[0];
                      if (!f) {
                        return;
                      }
                      const m = actions.importData(await f.text());
                      toast(m ?? 'Data imported', m ? { tone: 'error' } : undefined);
                      e.target.value = '';
                    })()
                  }
                />
                <ResetDemoButton />
              </>
            )}
          </div>
        </section>
        <section className="panel settings-tile">
          <h2>Keyboard shortcuts</h2>
          <dl className="keys">
            <div>
              <dt>
                <kbd className="kbd">C</kbd>
              </dt>
              <dd>Create a task</dd>
            </div>
            <div>
              <dt>
                <kbd className="kbd">/</kbd> or <kbd className="kbd">⌘K</kbd>
              </dt>
              <dd>Search</dd>
            </div>
            <div>
              <dt>
                <kbd className="kbd">Alt</kbd> <kbd className="kbd">←</kbd> <kbd className="kbd">→</kbd>
              </dt>
              <dd>Move a focused card between columns</dd>
            </div>
            <div>
              <dt>
                <kbd className="kbd">Esc</kbd>
              </dt>
              <dd>Close menus and panels</dd>
            </div>
          </dl>
        </section>
        <ArchivedCampsCard camps={archivedCamps} />
        {camp?.canDelete && !camp.archived && <DangerZone campId={camp.id} campName={camp.name} />}
      </div>
    </div>
  );
}
