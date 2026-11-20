'use client';

import { useActionState, useCallback, useEffect, useState } from 'react';
import { Dialog } from '@/components/components/Dialog';
import { Button, Checkbox } from '@/components/atoms';
import { idle } from '@buxa/shared';
import { setTeachersAction } from '@/actions/classes';
import { ActionMessage } from './ActionMessage';

export interface TeacherChoice {
  id: string;
  name: string;
}

export interface ClassTeachers {
  id: string;
  name: string;
  /** The ids of the teachers assigned to this class. */
  teacherIds: string[];
}

/**
 * The teachers of each class in a session, with a dialog per class to change them. A teacher sees only the classes they are
 * assigned to; this list is for staff and admins (classes:manage), and the server checks that again on save.
 */
export function TeacherAssignments({
  sessionId,
  classes,
  teachers,
}: {
  sessionId: string;
  classes: ClassTeachers[];
  teachers: TeacherChoice[];
}) {
  if (teachers.length === 0) {
    return (
      <p className="class-helper">
        No one has the teacher role in this camp yet. Give a team member the teacher role on the Team page, then assign
        them here.
      </p>
    );
  }

  return (
    <ul className="stack">
      {classes.map(item => (
        <TeacherRow key={item.id} sessionId={sessionId} item={item} teachers={teachers} />
      ))}
    </ul>
  );
}

function TeacherRow({
  sessionId,
  item,
  teachers,
}: {
  sessionId: string;
  item: ClassTeachers;
  teachers: TeacherChoice[];
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const names = teachers.filter(t => item.teacherIds.includes(t.id)).map(t => t.name);

  return (
    <li className="class-teacher-row">
      <span>{item.name}</span>
      <span className="class-helper">{names.length > 0 ? names.join(', ') : 'No teacher yet'}</span>
      <Button type="button" variant="ghost" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        Change teachers
      </Button>
      {open && (
        <Dialog title={`Teachers for ${item.name}`} onClose={close} className="class-dialog">
          <TeacherForm sessionId={sessionId} item={item} teachers={teachers} onCancel={close} onSaved={close} />
        </Dialog>
      )}
    </li>
  );
}

function TeacherForm({
  sessionId,
  item,
  teachers,
  onCancel,
  onSaved,
}: {
  sessionId: string;
  item: ClassTeachers;
  teachers: TeacherChoice[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [state, formAction, pending] = useActionState(setTeachersAction, idle);

  useEffect(() => {
    if (state.status === 'success') {
      onSaved();
    }
  }, [state, onSaved]);

  return (
    <form action={formAction} className="class-form session-form">
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="classId" value={item.id} />
      <fieldset className="price-fields">
        <legend className="class-helper">Teachers see this class only if they are ticked here.</legend>
        {teachers.map(teacher => (
          <Checkbox
            key={teacher.id}
            name="teacherIds"
            value={teacher.id}
            defaultSelected={item.teacherIds.includes(teacher.id)}
          >
            {teacher.name}
          </Checkbox>
        ))}
      </fieldset>
      <ActionMessage state={state} />
      <div className="classes-actions">
        <Button type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Saving...' : 'Save teachers'}
        </Button>
      </div>
    </form>
  );
}
