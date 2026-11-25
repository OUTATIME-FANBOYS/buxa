import type { Project, Task } from '@buxa/shared';
import { useStore } from '@buxa/middleware/providers/providers';
import { Dialog } from '@/components/components';
import { Field, Button, TAG } from '@/components/elements';
import { Select } from '@/components/atoms';
import { useUi } from '@buxa/middleware/providers/UiProvider';
import { useTaskCommands } from '@buxa/middleware/hooks/hooks';
import { useTaskDraft } from '@buxa/middleware/hooks/hooks';
import { TaskDrawerHeader } from './TaskDrawerHeader';

// The title: a large, borderless text area that shows an edge only on hover (its own rules beat the field defaults, so they
// are forced).
const TITLE_INPUT =
  'buxa:text-[length:var(--fs-h)]! buxa:font-semibold! buxa:tracking-[-0.01em] buxa:border-transparent! buxa:[padding:var(--s2)]! buxa:[margin:0_calc(var(--s2)*-1)] buxa:w-[calc(100%+var(--s4))]! buxa:resize-none! buxa:[field-sizing:content] buxa:min-h-[44px] buxa:bg-transparent! buxa:enabled:hover:bg-[var(--hover)]! buxa:enabled:hover:border-transparent!';
import { TaskProperties } from './TaskProperties';
import { TaskSections } from './TaskSections';

interface TaskFormProps {
  task: Task | null;
  /** The projects the task may go to. One for a saved task or a board; several when `chooseProject` is set. */
  projects: readonly Project[];
  defaults?: { columnId?: string; due?: string };
  /** A new task gets a PROJECT field, and the person picks the project (the Calendar). */
  chooseProject?: boolean;
  onClose: () => void;
}

/** The task drawer's content: header, title, properties, description, then (for a saved task) subtasks, files and discussion. */
export function TaskForm({ task, projects, defaults, chooseProject = false, onClose }: TaskFormProps) {
  const { actions, readOnly: ro, members, userById } = useStore();
  const { confirm } = useUi();
  const cmd = useTaskCommands();
  const d = useTaskDraft(task, projects, defaults);
  const showProjectField = !task && chooseProject;
  const del = async () => {
    if (
      task &&
      (await confirm({
        title: 'Delete this task?',
        body: 'Comments, files and history go with it. You can undo right after.',
        confirmLabel: 'Delete',
        danger: true,
      }))
    ) {
      cmd.remove(task);
      onClose();
    }
  };

  return (
    <Dialog drawer onClose={onClose} labelledBy="drawer-title">
      {close => (
        <>
          <TaskDrawerHeader task={task} project={d.project} readOnly={ro} onClose={close} onDelete={() => void del()} />
          <fieldset
            disabled={ro}
            className="plain buxa:border-0 buxa:p-0 buxa:m-0 buxa:min-w-0 buxa:grid buxa:gap-[var(--s4)]"
          >
            {showProjectField && (
              <Select
                label="Project"
                isRequired
                placeholder="Choose a project"
                value={d.projectId}
                error={d.errs.project}
                onChange={value => {
                  if (value) {
                    d.chooseProject(value);
                  }
                }}
                options={projects.map(p => ({ value: p.id, label: p.name }))}
              />
            )}
            <div className="drawer-title buxa:grid buxa:gap-[var(--s1)]">
              <label className="sr-only" htmlFor="drawer-title">
                Title
              </label>
              <textarea
                id="drawer-title"
                className={TITLE_INPUT}
                rows={1}
                value={d.title}
                placeholder="Task title"
                data-autofocus={d.isNew || undefined}
                aria-invalid={!!d.errs.title}
                onChange={e => {
                  d.setTitle(e.target.value);
                  d.clearTitleError();
                }}
                onBlur={d.commitTitle}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (d.isNew) {
                      d.create();
                    } else {
                      (e.target as HTMLElement).blur();
                    }
                  }
                }}
              />
              {d.errs.title && (
                <span className="field-error buxa:text-[length:var(--fs-s)] buxa:text-[var(--crit)]" role="alert">
                  {d.errs.title}
                </span>
              )}
              {task?.archived && <span className={`tag ${TAG}`}>Archived</span>}
            </div>
            <TaskProperties task={task} project={d.project} d={d} />
            <Field label="Description">
              <textarea
                rows={4}
                value={d.desc}
                placeholder="Add context, links, acceptance criteria…"
                onChange={e => d.setDesc(e.target.value)}
                onBlur={() => {
                  if (task && d.desc !== task.description) {
                    actions.updateTask(task.id, { description: d.desc });
                  }
                }}
              />
            </Field>
          </fieldset>
          {task ? (
            <TaskSections task={task} ro={ro} members={members.map(m => m.user)} userById={userById} />
          ) : (
            <div className="row-end sticky-foot buxa:sticky buxa:bottom-0 buxa:bg-[var(--surface)] buxa:pt-[var(--s3)]">
              <Button onClick={close}>Cancel</Button>
              {/* Stays visibly disabled until a project is chosen, but a press still runs create(), which says why. */}
              <Button
                variant="primary"
                icon="plus"
                aria-disabled={d.project ? undefined : true}
                className={d.project ? undefined : 'buxa:opacity-50'}
                onClick={d.create}
              >
                Create task
              </Button>
            </div>
          )}
        </>
      )}
    </Dialog>
  );
}
