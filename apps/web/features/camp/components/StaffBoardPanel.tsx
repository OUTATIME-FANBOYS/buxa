import Link from 'next/link';
import { Icon } from '@/components/ui';
import { ROUTES } from '@/config/routes';

export function StaffBoardPanel() {
  return (
    <section className="panel" aria-labelledby="board-title">
      <div className="panel-head"><h2 id="board-title">Staff tasks</h2></div>
      <p className="muted">The task board your team uses behind the scenes. It is a demo for now and keeps its data in this browser, separate from the camp.</p>
      <Link className="btn" href={ROUTES.kanban}><Icon name="kanban" size={16} /> Open the staff board</Link>
    </section>
  );
}
