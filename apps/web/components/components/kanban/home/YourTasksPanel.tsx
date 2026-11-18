import Link from 'next/link';
import type { Task } from '@buxa/shared';
import { boardPath, ROUTES } from '@/config/routes';
import { Button } from '@/components/elements/export';

const SHOWN = 5;

/**
 * The open tasks assigned to the signed-in person. The tasks live in this browser (not in the camp), so the panel says so.
 * `tasks` is already filtered to the person and to open work.
 */
export function YourTasksPanel({ tasks }: { tasks: readonly Task[] }) {
  return (
    <section className="panel" aria-labelledby="your-tasks-title">
      <div className="panel-head"><h2 id="your-tasks-title">Your tasks</h2></div>
      {tasks.length === 0 ? (
        <p className="muted">No tasks are assigned to you.</p>
      ) : (
        <ul className="plain-list">
          {tasks.slice(0, SHOWN).map(t => (
            <li key={t.id}><Link className="link" href={boardPath(t.projectId)}>{t.title}</Link></li>
          ))}
        </ul>
      )}
      {tasks.length > SHOWN && <p className="muted small">and {tasks.length - SHOWN} more</p>}
      <p className="muted small">Demo tasks, kept in this browser and separate from the camp.</p>
      <Button href={ROUTES.boards}>Open boards</Button>
    </section>
  );
}
