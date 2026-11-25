import { useStore } from '@buxa/middleware/providers/providers';
import { useTaskDrawer } from '@buxa/middleware/providers/providers';
import { TaskForm } from './TaskForm';

/**
 * Shows the drawer for whatever `useTaskDrawer()` says is open; renders nothing when it is closed or the task has gone.
 * A saved task keeps its own project. A new task opened with `chooseProject` (the Calendar) gets the workspace's projects
 * to pick from. Any other new task goes to its `projectId`, or else to the current project.
 */
export function TaskDrawer() {
  const { drawer, closeTask } = useTaskDrawer();
  const { s, project, projects } = useStore();
  if (!drawer) {
    return null;
  }
  if (drawer.id !== 'new') {
    const task = s.tasks.find(t => t.id === drawer.id);
    const owner = task ? s.projects.find(p => p.id === task.projectId) : undefined;
    if (!task || !owner) {
      return null;
    }

    return <TaskForm key={drawer.id} task={task} projects={[owner]} defaults={drawer.defaults} onClose={closeTask} />;
  }
  if (drawer.defaults?.chooseProject === true) {
    return (
      <TaskForm
        key="new"
        task={null}
        projects={projects}
        defaults={drawer.defaults}
        chooseProject
        onClose={closeTask}
      />
    );
  }
  const target = s.projects.find(p => p.id === (drawer.defaults?.projectId ?? project?.id));
  if (!target) {
    return null;
  }

  return <TaskForm key="new" task={null} projects={[target]} defaults={drawer.defaults} onClose={closeTask} />;
}
