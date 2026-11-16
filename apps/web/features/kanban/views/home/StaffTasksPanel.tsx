import Link from 'next/link';
import { Icon } from '../../../../elements';
import { ROUTES } from '../../../../config/routes';
import { taskSummary, type TaskCounts } from '../../../../logic/common';

/** A short summary of the task numbers, with the way into the boards. */
export function StaffTasksPanel({ tasks }: { tasks: TaskCounts }) {
  return (
    <section className="panel" aria-labelledby="staff-tasks-title">
      <div className="panel-head"><h2 id="staff-tasks-title">Staff tasks</h2></div>
      <p>{taskSummary(tasks)}</p>
      <p className="muted small">Demo tasks, kept in this browser and separate from the camp.</p>
      <Link className="btn" href={ROUTES.boards}><Icon name="kanban" size={16} /> Open boards</Link>
    </section>
  );
}
