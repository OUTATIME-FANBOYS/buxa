import type { Attachment, Filter, Task } from '../../types';
import * as D from '../../lib/domain';
import { uid } from '../../lib/tasks';
import type { ActionContext } from './context';

/** Task commands: ids are minted here, rules live in the domain. */
export function taskActions({ set }: ActionContext) {
  return {
    createTask(d: D.TaskDraft): string { const id = uid(); set(s => D.createTask(s, id, d)); return id; },
    updateTask: (id: string, patch: D.TaskPatch) => set(s => D.updateTask(s, id, patch)),
    moveTask: (id: string, columnId: string, beforeId: string | null) => set(s => D.moveTask(s, id, columnId, beforeId)),
    duplicateTask(id: string): string { const nid = uid(); set(s => D.duplicateTask(s, id, nid)); return nid; },
    archiveTask: (id: string, archived: boolean) => set(s => D.archiveTask(s, id, archived)),
    deleteTask: (id: string) => set(s => D.deleteTask(s, id)),
    restoreTask: (t: Task) => set(s => D.restoreTask(s, t)),
    addSubtask: (id: string, title: string) => set(s => D.addSubtask(s, id, title)),
    toggleSubtask: (id: string, sid: string) => set(s => D.toggleSubtask(s, id, sid)),
    removeSubtask: (id: string, sid: string) => set(s => D.removeSubtask(s, id, sid)),
    addComment: (id: string, body: string) => set(s => D.addComment(s, id, body)),
    addAttachment: (id: string, a: Omit<Attachment, 'id' | 'at'>) => set(s => D.addAttachment(s, id, a)),
    removeAttachment: (id: string, aid: string) => set(s => D.removeAttachment(s, id, aid)),
    saveFilter: (name: string, projectId: string, filter: Filter) => set(s => D.saveFilter(s, name, projectId, filter)),
    deleteSavedFilter: (id: string) => set(s => D.deleteSavedFilter(s, id)),
    markNoticeRead: (id: string) => set(s => D.markNoticeRead(s, id)),
    markAllRead: () => set(D.markAllRead),
  };
}
