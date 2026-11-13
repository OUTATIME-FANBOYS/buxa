import { useState } from 'react';
import type { Priority, Project, Task } from '../types';
import { useStore } from '../state/store';
import { useTaskDrawer } from '../state/TaskDrawerContext';
import { datesError, titleError } from '../lib/taskValidation';
import { useUi } from '@/components/ui';

type Errors = { title?: string; due?: string };

/**
 * The drawer's form. A new task is held locally until "Create"; an existing task is written through to the store on each change.
 * Field values stay as independent state; only the validation messages are grouped.
 */
export function useTaskDraft(task: Task | null, project: Project, defaults?: { columnId?: string; due?: string }) {
  const { actions, me } = useStore(); const { toast } = useUi(); const { openTask } = useTaskDrawer();
  const isNew = !task;
  const [title, setTitle] = useState(task?.title ?? ''); const [desc, setDesc] = useState(task?.description ?? '');
  const [start, setStart] = useState(task?.start ?? ''); const [due, setDue] = useState(task?.due ?? defaults?.due ?? '');
  const [columnId, setColumnId] = useState(task?.columnId ?? defaults?.columnId ?? project.columns[0]?.id ?? '');
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'medium'); const [assignee, setAssignee] = useState(task?.assigneeId ?? me?.id ?? '');
  const [tags, setTags] = useState<string[]>(task?.tags ?? []);
  const [errs, setErrs] = useState<Errors>({});

  const commitTitle = () => {
    if (!task) return;
    const err = titleError(title); setErrs(e => ({ ...e, title: err }));
    const t = title.trim(); if (!err && t !== task.title) actions.updateTask(task.id, { title: t });
  };
  const changeDates = (st: string, du: string, which: 'start' | 'due') => {
    setStart(st); setDue(du);
    const err = datesError(st, du); setErrs(e => ({ ...e, due: err }));
    if (!err && task) actions.updateTask(task.id, which === 'start' ? { start: st || undefined } : { due: du || undefined });
  };
  const create = () => {
    const er: Errors = { title: titleError(title), due: datesError(start, due) };
    setErrs(er); if (er.title || er.due) return;
    const id = actions.createTask({ projectId: project.id, columnId, title: title.trim(), description: desc.trim(), priority, assigneeId: assignee || undefined, start: start || undefined, due: due || undefined, tags });
    toast('Task created'); openTask(id);
  };
  const clearTitleError = () => { if (errs.title) setErrs(x => ({ ...x, title: undefined })); };
  return { isNew, title, setTitle, desc, setDesc, start, due, columnId, setColumnId, priority, setPriority, assignee, setAssignee, tags, setTags, errs, commitTitle, changeDates, create, clearTitleError };
}
export type TaskDraft = ReturnType<typeof useTaskDraft>;
