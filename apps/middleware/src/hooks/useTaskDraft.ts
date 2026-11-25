'use client';

import { useState } from 'react';
import type { Priority, Project, Task } from '@buxa/shared';
import { useStore } from '../providers/providers';
import { useTaskDrawer } from '../providers/providers';
import { datesError, titleError } from '@buxa/shared';
import { useUi } from '../providers/UiProvider';

type Errors = { title?: string; due?: string; project?: string };

const PROJECT_REQUIRED = 'Choose a project for this task.';

/**
 * The drawer's form. A new task is held locally until "Create"; an existing task is written through to the store on each change.
 * `projects` is the list the task may go to: one project for a board or a saved task, several when the person picks one.
 * With exactly one project it is preselected; otherwise no project is chosen until the person picks one (`project` is null).
 * Choosing a project resets the status to that project's first column.
 * Field values stay as independent state; only the validation messages are grouped.
 */
export function useTaskDraft(
  task: Task | null,
  projects: readonly Project[],
  defaults?: { columnId?: string; due?: string },
) {
  const { actions, me } = useStore();
  const { toast } = useUi();
  const { openTask } = useTaskDrawer();
  const isNew = !task;
  const [title, setTitle] = useState(task?.title ?? '');
  const [desc, setDesc] = useState(task?.description ?? '');
  const [start, setStart] = useState(task?.start ?? '');
  const [due, setDue] = useState(task?.due ?? defaults?.due ?? '');
  const [projectId, setProjectId] = useState(task?.projectId ?? (projects.length === 1 ? projects[0].id : ''));
  const project = projects.find(p => p.id === projectId) ?? null;
  const [columnId, setColumnId] = useState(task?.columnId ?? defaults?.columnId ?? project?.columns[0]?.id ?? '');
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'medium');
  const [assignee, setAssignee] = useState(task?.assigneeId ?? me?.id ?? '');
  const [errs, setErrs] = useState<Errors>({});

  const commitTitle = () => {
    if (!task) {
      return;
    }
    const err = titleError(title);
    setErrs(e => ({ ...e, title: err }));
    const t = title.trim();
    if (!err && t !== task.title) {
      actions.updateTask(task.id, { title: t });
    }
  };
  const changeDates = (st: string, du: string, which: 'start' | 'due') => {
    setStart(st);
    setDue(du);
    const err = datesError(st, du);
    setErrs(e => ({ ...e, due: err }));
    if (!err && task) {
      actions.updateTask(task.id, which === 'start' ? { start: st || undefined } : { due: du || undefined });
    }
  };
  const chooseProject = (id: string) => {
    const next = projects.find(p => p.id === id) ?? null;
    setProjectId(id);
    setColumnId(next?.columns[0]?.id ?? '');
    setErrs(e => ({ ...e, project: undefined }));
  };
  const create = () => {
    const er: Errors = {
      title: titleError(title),
      due: datesError(start, due),
      project: project ? undefined : PROJECT_REQUIRED,
    };
    setErrs(er);
    if (!project || er.title || er.due) {
      return;
    }
    const id = actions.createTask({
      projectId: project.id,
      columnId,
      title: title.trim(),
      description: desc.trim(),
      priority,
      assigneeId: assignee || undefined,
      start: start || undefined,
      due: due || undefined,
    });
    toast('Task created');
    openTask(id);
  };
  const clearTitleError = () => {
    if (errs.title) {
      setErrs(x => ({ ...x, title: undefined }));
    }
  };

  return {
    isNew,
    project,
    projectId,
    chooseProject,
    title,
    setTitle,
    desc,
    setDesc,
    start,
    due,
    columnId,
    setColumnId,
    priority,
    setPriority,
    assignee,
    setAssignee,
    errs,
    commitTitle,
    changeDates,
    create,
    clearTitleError,
  };
}
export type TaskDraft = ReturnType<typeof useTaskDraft>;
