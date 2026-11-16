import { useStore } from '../state/store';
import { CalendarView } from '../components/board-views';

export function WorkspaceCalendar() {
  const { wsTasks, readOnly, projects, project } = useStore();
  return (
    <div className="page"><header className="page-head"><div className="page-title"><h1>Calendar</h1><p className="muted">Deadlines across every project in this workspace</p></div></header>
      <CalendarView tasks={wsTasks.filter(t => !t.archived)} canCreate={!readOnly && projects.length > 0} projectId={project?.id} /></div>
  );
}
