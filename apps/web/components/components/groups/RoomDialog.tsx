'use client';

import { useActionState, useCallback, useEffect, useRef, useState } from 'react';
import type { Room } from '@buxa/contracts';
import { fieldError, idle } from '@buxa/shared';
import { useUi } from '@buxa/middleware/providers/UiProvider';
import { saveRoomAction } from '@/actions/groups';
import { FormPopUp } from '@/components/components';
import { Button } from '@/components/elements';
import { HiddenField, TextField } from '@/components/atoms';
import { ActionMessage } from '@/components/components/classes/forms';

const FORM_ID = 'room-form';

/**
 * The New room button, or the Edit button on a room's row. A room is booked for this session: its name, where it is, and how many
 * campers it holds. Two sessions that share a day cannot both use a room with the same name and location.
 */
export function RoomDialog({ sessionId, room }: { sessionId: string; room?: Room }) {
  const [open, setOpen] = useState(false);
  const { toast } = useUi();
  const close = useCallback(() => setOpen(false), []);
  const saved = useCallback(
    (message: string) => {
      toast(message);
      setOpen(false);
    },
    [toast],
  );

  return (
    <>
      {room ? (
        <Button
          variant="ghost"
          size="sm"
          type="button"
          icon="edit"
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
        >
          Edit<span className="sr-only"> {room.name}</span>
        </Button>
      ) : (
        <Button
          variant="glass"
          size="sm"
          type="button"
          icon="plus"
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
        >
          New room
        </Button>
      )}
      {open && <RoomPopUp sessionId={sessionId} room={room} onCancel={close} onSaved={saved} />}
    </>
  );
}

function RoomPopUp({
  sessionId,
  room,
  onCancel,
  onSaved,
}: {
  sessionId: string;
  room?: Room;
  onCancel: () => void;
  onSaved: (message: string) => void;
}) {
  const [state, formAction, pending] = useActionState(saveRoomAction, idle);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === 'success') {
      onSaved(state.message ?? 'Room saved.');
    }
  }, [state, onSaved]);

  useEffect(() => {
    if (state.status === 'error' && state.fieldErrors) {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  }, [state]);

  return (
    <FormPopUp
      title={room ? 'Edit room' : 'New room'}
      formId={FORM_ID}
      submitLabel={room ? 'Save room' : 'Add room'}
      pendingLabel="Saving..."
      submitIcon={room ? 'check' : 'plus'}
      pending={pending}
      onCancel={onCancel}
    >
      <form ref={formRef} id={FORM_ID} action={formAction} className="stack">
        <HiddenField name="sessionId" value={sessionId} />
        {room && <HiddenField name="roomId" value={room.id} />}
        <TextField
          label="Name"
          name="name"
          isRequired
          defaultValue={room?.name ?? ''}
          error={fieldError(state, 'name')}
          maxLength={120}
          autoComplete="off"
        />
        <TextField
          label="Location"
          name="location"
          isRequired
          defaultValue={room?.location ?? ''}
          error={fieldError(state, 'location')}
          maxLength={120}
          hint="For example, North site or Lodge."
        />
        <TextField
          label="Capacity (campers)"
          name="capacity"
          isRequired
          inputMode="numeric"
          defaultValue={room ? String(room.capacity) : ''}
          error={fieldError(state, 'capacity')}
        />
        <ActionMessage state={state} />
      </form>
    </FormPopUp>
  );
}
