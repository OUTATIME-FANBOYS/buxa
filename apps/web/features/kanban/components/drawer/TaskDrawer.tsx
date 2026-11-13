import { useStore } from '../../state/store';
import { useTaskDrawer } from '../../state/TaskDrawerContext';
import { TaskForm } from './TaskForm';

/** Shows the drawer for whatever `useTaskDrawer()` says is open; renders nothing when it is closed or the task has gone. */
export function TaskDrawer() {
  const { drawer, closeTask } = useTaskDrawer();
  const { s, project } = useStore();
  if (!drawer) return null;
  const task = drawer.id === 'new' ? null : s.tasks.find(t => t.id === drawer.id);
  if (drawer.id !== 'new' && !task) return null;
  const projectId = task?.projectId ?? drawer.defaults?.projectId ?? project?.id;
  const target = s.projects.find(p => p.id === projectId);
  if (!target) return null;
  return <TaskForm key={drawer.id} task={task ?? null} project={target} defaults={drawer.defaults} onClose={closeTask} />;
}
