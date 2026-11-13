# Buxa — Kanban for people and agents

React + TypeScript + Vite. No backend: data persists in `localStorage`, auth is local (SHA‑256 hashed passwords).

```
npm install
npm run dev      # http://localhost:5173
npm run build
```

**Demo:** on the sign-in screen choose "Continue as Maya Chen" (demo accounts use password `demo1234`).
Use the avatar menu to switch persona and see their notifications.

## Structure
- `apps/web/src/store.tsx` — single state container, all actions, autosave (debounced) to localStorage
- `apps/web/src/lib/` — dates, task/filter helpers, seed data, hash router
- `apps/web/src/components/` — Shell, Board (drag & drop), TaskDrawer, FilterBar, Views (list/calendar/timeline), charts, primitives
- `apps/web/src/pages/` — Dashboard, My Tasks, Projects, Board, Team, Reports, Settings

## Keyboard
`C` new task · `/` or `⌘K` search · focus a card and press `Alt + ←/→` to move it · `Esc` closes menus/panels.
Cards also have a ⋯ menu with "Move to…" for touch and keyboard users.

## Limits
Browser storage only (≈5 MB): attachments ≤ 1 MB each. Export/Import JSON in Settings to back up or move data.

## Agents (optional)

Turn on **Settings → Agents** to let AI agents work on your boards. Leave it off and Buxa is a plain Kanban board.

- An agent never edits a board directly. It **proposes** a change; a per-agent trust policy (Allow / Ask me / Block, per kind of change) decides whether it is applied, queued in the **Inbox**, or refused.
- Approved and automatic changes run through the normal domain commands *as the agent*, so history and notifications work as usual and record the run and the agent's reason.
- **History** is the audit trail. A whole run can be reverted where nobody has worked on its changes since.
- Agents are limited to the projects you choose. An approval is refused if the task changed after the proposal was made.
- "Try a simulated run" uses a scripted agent that goes through the same path a real agent will. Real agents (over MCP or an API) are the next step; see `apps/web/src/lib/agents.ts`.

## Local server and MCP (connect a real agent)

The app works on its own in the browser. Run the local server to share its data with agents:

```bash
npm run server        # http://localhost:8787  (data in .buxa-data/)
npm run dev           # the app on http://localhost:5199, proxied to the server
```

The app detects the server on load and shows **Synced** in the top bar (or **Saved** when it is running alone).
Then open **Agents → your agent → Connect to Claude**, create a token, and run the command it shows, for example:

```bash
claude mcp add --transport http buxa http://localhost:8787/mcp --header "Authorization: Bearer <token>"
```

- Each agent has its own token, shown once and stored only as a hash. The token decides who the agent is; it cannot pick another identity.
- Tools: `whoami`, `list_projects`, `list_tasks`, `get_task`, `create_task`, `update_task`, `move_task`, `add_comment`, `list_my_proposals`, `list_proposals_to_review`, `review_proposal`.
- Writes are **proposals**. Every one goes through the same trust policy as the simulated agent: applied, held for approval, or blocked. The agent is told which.
- The server listens on `127.0.0.1` only, answers only requests addressed to `localhost`, and refuses cross-site requests.
- Changes made by an agent appear in the app live. If you edit at the same moment, your unsaved edits are replayed on top of the server's data.
- `npm start` builds the app and serves it from the server on one port.

**Limits:** this is a single-user, same-machine setup. There are no accounts or roles on the server itself, so anything on your machine that can reach port 8787 (or read `.buxa-data/`) is trusted. Sharing it with other people or exposing it over a network needs real authentication first.
