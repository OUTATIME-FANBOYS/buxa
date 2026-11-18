'use client';

import { useRef, useState, type ReactNode } from 'react';
import { useStore } from '@buxa/middleware/providers/providers';
import { Field, Button } from '@/components/elements/export';
import { Segmented } from '@/components/elements/export';
import { useUi } from '@buxa/middleware/providers/UiProvider';
import { ROUTES } from '@/config/routes';
import { AgentDialog } from '@/components/components/kanban/dialogs/export';
import { ResetDemoButton } from '@/components/components/kanban/export';
import { ArchivedCampsCard, DangerZone } from '@/components/components/camp/export';
import type { ArchivedCamp } from '@/actions/camp';
import type { ThemePref } from '@buxa/shared';

/** The camp the settings are for. `canDelete` is the owner's right (org:delete); an archived camp shows no danger zone. */
export interface SettingsCamp {
  id: string;
  name: string;
  canDelete: boolean;
  archived: boolean;
}

/** Every setting is a card in one grid: the cards fill the page and reflow by width (see styles/features/settings.css). `clock` is the camp clock, shown inside the Appearance card. */
export function Settings({
  clock,
  camp,
  archivedCamps = [],
}: {
  clock?: ReactNode;
  camp?: SettingsCamp;
  archivedCamps?: readonly ArchivedCamp[];
}) {
  const { s, actions, me, readOnly } = useStore();
  const { toast } = useUi();
  const [name, setName] = useState(me?.name ?? '');
  const [title, setTitle] = useState(me?.title ?? '');
  const [err, setErr] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const [addAgent, setAddAgent] = useState(false);
  const on = s.ui.agentsEnabled;
  const hasAgents = s.agents.length > 0;
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
        <section className="panel" id="profile">
          <h2>Profile</h2>
          <form
            className="stack"
            noValidate
            onSubmit={e => {
              e.preventDefault();
              if (!name.trim()) {
                return setErr('Name can’t be empty.');
              }
              actions.updateProfile({ name: name.trim(), title: title.trim() || undefined });
              setErr(null);
              toast('Profile saved');
            }}
          >
            <Field label="Name" error={err}>
              <input value={name} onChange={e => setName(e.target.value)} maxLength={60} />
            </Field>
            <Field label="Role or title">
              <input value={title} onChange={e => setTitle(e.target.value)} maxLength={60} />
            </Field>
            <Field label="Email">
              <input value={me?.email ?? ''} disabled />
            </Field>
            <div>
              <Button variant="primary">Save profile</Button>
            </div>
          </form>
        </section>
        <section className="panel">
          <h2>Appearance</h2>
          <Segmented<ThemePref>
            label="Theme"
            value={s.ui.theme}
            onChange={actions.setTheme}
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light', icon: 'sun' },
              { value: 'dark', label: 'Dark', icon: 'moon' },
            ]}
          />
          {clock && <div className="settings-sub">{clock}</div>}
        </section>
        <section className="panel">
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
        <section className="panel">
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
                  onChange={async e => {
                    const f = e.target.files?.[0];
                    if (!f) {
                      return;
                    }
                    const m = actions.importData(await f.text());
                    toast(m ?? 'Data imported', m ? { tone: 'error' } : undefined);
                    e.target.value = '';
                  }}
                />
                <ResetDemoButton />
              </>
            )}
          </div>
        </section>
        <section className="panel">
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
