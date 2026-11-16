import type { Task } from '../../types';
import { AttachmentList } from './AttachmentList';
import { Discussion } from './Discussion';
import { SubtaskList } from './SubtaskList';

interface TaskSectionsProps { task: Task; ro: boolean; members: { id: string; name: string }[]; userById: (id?: string) => { name: string } | undefined }

/** Everything below the properties of a saved task. */
export function TaskSections({ task, ro, members, userById }: TaskSectionsProps) {
  return (
    <>
      <SubtaskList task={task} ro={ro} />
      <AttachmentList task={task} ro={ro} />
      <Discussion task={task} ro={ro} members={members} userById={userById} />
    </>
  );
}
