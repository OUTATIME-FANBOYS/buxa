'use client';

import { useRef, useState } from 'react';
import { useStore } from '@buxa/middleware/providers/providers';
import { Button } from '@/components/elements';
import { useUi } from '@buxa/middleware/providers/UiProvider';
import { ROUTES } from '@/config/routes';
import { AgentDialog } from '@/components/components/kanban/dialogs';
import { ResetDemoButton } from '@/components/components/kanban';
import { SETTINGS_GRID, SETTINGS_TILE_HEADING, SETTINGS_TILE_TEXT } from '@/components/components/settings';
import { ArchivedCampsCard, CalendarLinkCard, DangerZone } from '@/components/components/camp';
import type { ArchivedCamp } from '@/actions/camp';

/** The camp the settings are for. `canDelete` is the owner's right (org:delete); an archived camp shows no danger zone. */
export interface SettingsCamp {
  id: string;
  name: string;
  canDelete: boolean;
  /** The owner and admins (org:update). Staff and teachers do not see the camp calendar link. */
  canManageFeed: boolean;
  /** A teacher sees a personal calendar link here, for their own assigned classes only. */
  isTeacher: boolean;
  archived: boolean;
}

/**
 * Camp settings: one grid of cards for the camp this person is working in. The person's own settings (name, email, time
 * format, appearance) are on the Profile page, which a link at the top points to. Then the Agents, data and shortcut cards,
 * the camp calendar link, archived camps and the danger zone. On a phone every card stacks.
 */
export function Settings({
  camp,
  archivedCamps = [],
}: {
  camp?: SettingsCamp;
  archivedCamps?: readonly ArchivedCamp[];
}) {
  const { s, actions, readOnly } = useStore();
  const { toast } = useUi();
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
    // Settings: every setting is a full-width card, stacked in one column, as Cloudflare's account settings. Cards share
    // .panel, so padding and style match. The page is as wide as the window, not the 1240px page width (forced: .page is
    // unlayered CSS).
    <div className="page settings-page buxa:max-w-none!">
      <header className="page-head">
        <div className="page-title">
          <h1>Settings</h1>
        </div>
        <Button variant="glass" href={ROUTES.account}>
          Your profile
        </Button>
      </header>
      <div className={`settings-grid ${SETTINGS_GRID}`}>
        <section className="panel settings-tile">
          <h2 className={SETTINGS_TILE_HEADING}>Agents</h2>
          <p className={`muted ${SETTINGS_TILE_TEXT}`}>
            Let AI agents add and update tasks on your boards. Their changes can wait for your approval, and every one
            is recorded. Leave this off and Buxa is a plain Kanban board.
          </p>
          <label className="check-row">
            <input type="checkbox" checked={on} onChange={e => actions.setAgentsEnabled(e.target.checked)} />
            <span>Turn on agents</span>
          </label>
          {on && (
            <div className="row">
              {!readOnly && (
                <Button variant="glass" onClick={() => setAddAgent(true)}>
                  Add an agent
                </Button>
              )}
              {hasAgents && (
                <Button variant="glass" href={ROUTES.agents}>
                  Open Agents
                </Button>
              )}
            </div>
          )}
          {addAgent && <AgentDialog onClose={() => setAddAgent(false)} />}
        </section>
        <section className="panel settings-tile">
          <h2 className={SETTINGS_TILE_HEADING}>Your data</h2>
          <p className={`muted ${SETTINGS_TILE_TEXT}`}>
            Everything lives in this browser’s storage. Export a copy to back it up or move it to another device.
          </p>
          <div className="row">
            <Button variant="glass" onClick={exportJson}>
              Export JSON
            </Button>
            {!readOnly && (
              <>
                <Button variant="glass" onClick={() => file.current?.click()}>
                  Import JSON
                </Button>
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
          <h2 className={SETTINGS_TILE_HEADING}>Keyboard shortcuts</h2>
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
        {camp?.canManageFeed && !camp.archived && <CalendarLinkCard />}
        {camp?.isTeacher && !camp.archived && <CalendarLinkCard own />}
        <ArchivedCampsCard camps={archivedCamps} />
        {camp?.canDelete && !camp.archived && <DangerZone campId={camp.id} campName={camp.name} />}
      </div>
    </div>
  );
}
