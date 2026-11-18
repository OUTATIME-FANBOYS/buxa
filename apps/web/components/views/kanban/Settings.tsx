'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ClockFormat, User } from '@buxa/contracts';
import { useStore } from '@buxa/middleware/providers/providers';
import { Button, Segmented } from '@/components/elements';
import { useUi } from '@buxa/middleware/providers/UiProvider';
import { ROUTES } from '@/config/routes';
import { AgentDialog } from '@/components/components/kanban/dialogs';
import { ResetDemoButton } from '@/components/components/kanban';
import { ArchivedCampsCard, DangerZone, UpdateDisplayNameDialog } from '@/components/components/camp';
import type { ArchivedCamp } from '@/actions/camp';
import { updateTimeFormatAction } from '@/actions/account';
import { browserClockFormat, localTimeZone } from '@buxa/shared/clockPreference';
import { fullNameOf } from '@buxa/shared/names';

/** The camp the settings are for. `canDelete` is the owner's right (org:delete); an archived camp shows no danger zone. */
export interface SettingsCamp {
  id: string;
  name: string;
  canDelete: boolean;
  archived: boolean;
}

const TIME_FORMATS: { value: ClockFormat; label: string }[] = [
  { value: '12h', label: '12-hour (9:05 AM)' },
  { value: '24h', label: '24-hour (09:05)' },
];

/**
 * Every setting is a tile in one grid. The name and email tile spans the full width, the time format and camp clock tiles share
 * a row, and the danger zone spans the bottom (see styles/features/settings.css). On a phone every tile stacks.
 * Appearance (light, dark, system) is not here: it is in the account menu. `clock` is the camp clock panel.
 */
export function Settings({
  clock,
  camp,
  user,
  archivedCamps = [],
}: {
  clock?: ReactNode;
  camp?: SettingsCamp;
  user?: User;
  archivedCamps?: readonly ArchivedCamp[];
}) {
  const { s, actions, me, readOnly } = useStore();
  const { toast } = useUi();
  const file = useRef<HTMLInputElement>(null);
  const [addAgent, setAddAgent] = useState(false);
  const [editName, setEditName] = useState(false);
  const [browser, setBrowser] = useState<ClockFormat>('24h');
  const [zone, setZone] = useState('');
  useEffect(() => {
    setBrowser(browserClockFormat());
    setZone(localTimeZone());
  }, [setBrowser, setZone]);
  const on = s.ui.agentsEnabled;
  const hasAgents = s.agents.length > 0;
  const firstName = user?.firstName ?? me?.name.split(' ')[0] ?? '';
  const lastName = user?.lastName ?? null;
  const fullName = user ? fullNameOf(user.firstName, user.lastName) : (me?.name ?? '');
  const clockFormat: ClockFormat = user?.clockFormat ?? browser;

  // The name is saved to the signed-in account first: the greeting, the account menu and the team list read it from there.
  // Only then does the board's own copy change, so it never shows a name the account does not have.
  const savedName = (saved: { firstName: string; lastName: string | null }, title: string) => {
    actions.updateProfile({ name: fullNameOf(saved.firstName, saved.lastName), title: title.trim() || undefined });
    toast('Profile saved');
  };
  const chooseTimeFormat = async (format: ClockFormat) => {
    const saved = await updateTimeFormatAction({ clockFormat: format });
    toast(
      saved.status === 'error' ? saved.message : 'Time format saved',
      saved.status === 'error' ? { tone: 'error' } : undefined,
    );
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
        <section className="panel settings-tile settings-tile--full" id="profile" aria-labelledby="name-email-title">
          <h2 id="name-email-title">Name and email</h2>
          <dl className="settings-facts">
            <div>
              <dt>Name</dt>
              <dd>{fullName || '—'}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>
                {user?.email ?? me?.email ?? ''}
                <span className="muted settings-note">
                  {' '}
                  Your email comes from your sign-in and can’t be changed here.
                </span>
              </dd>
            </div>
          </dl>
          <div>
            <Button onClick={() => setEditName(true)}>Update display name</Button>
          </div>
          {editName && user && (
            <UpdateDisplayNameDialog
              firstName={firstName}
              lastName={lastName}
              title={me?.title ?? ''}
              onClose={() => setEditName(false)}
              onSaved={(saved, title) => savedName(saved, title)}
            />
          )}
        </section>
        <section className="panel settings-tile settings-tile--half" aria-labelledby="time-format-title">
          <h2 id="time-format-title">Time format</h2>
          <p className="muted">
            How times show for you. Until you choose, your browser’s setting is used
            {zone ? ` (${zone}).` : '.'}
          </p>
          <Segmented<ClockFormat>
            label="Time format"
            value={clockFormat}
            onChange={format => void chooseTimeFormat(format)}
            options={TIME_FORMATS}
          />
        </section>
        {clock && <section className="panel settings-tile settings-tile--half">{clock}</section>}
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
