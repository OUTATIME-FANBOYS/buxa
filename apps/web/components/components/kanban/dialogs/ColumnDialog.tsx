'use client';

import { useState } from 'react';
import { Dialog } from '@/components/components/export';
import { Button } from '@/components/elements/export';
import { Select, TextField } from '@/components/atoms';
import { useStore } from '@buxa/middleware/providers/providers';
import type { Column, ColumnKind } from '@buxa/shared';

export function ColumnDialog({
  projectId,
  column,
  onClose,
}: {
  projectId: string;
  column?: Column;
  onClose: () => void;
}) {
  const { actions } = useStore();
  const [name, setName] = useState(column?.name ?? '');
  const [kind, setKind] = useState<ColumnKind>(column?.kind ?? 'active');
  const [err, setErr] = useState<string | null>(null);

  return (
    <Dialog title={column ? 'Edit column' : 'New column'} onClose={onClose}>
      <form
        className="stack"
        noValidate
        onSubmit={e => {
          e.preventDefault();
          if (!name.trim()) {
            return setErr('Name the column.');
          }
          if (name.length > 30) {
            return setErr('Keep it under 30 characters.');
          }
          if (column) {
            actions.updateColumn(projectId, column.id, { name: name.trim(), kind });
          } else {
            actions.createColumn(projectId, name.trim(), kind);
          }
          onClose();
        }}
      >
        <TextField
          label="Name"
          error={err}
          value={name}
          onChange={value => {
            setName(value);
            setErr(null);
          }}
          autoFocus
          placeholder="e.g. Blocked"
        />
        <Select
          label="Counts as"
          hint="Used by the dashboard and reports to measure progress."
          value={kind}
          onChange={value => {
            if (value) {
              setKind(value as ColumnKind);
            }
          }}
          options={[
            { value: 'open', label: 'Not started' },
            { value: 'active', label: 'In progress' },
            { value: 'done', label: 'Done' },
          ]}
        />
        <div className="row-end">
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon={column ? 'save' : 'plus'}>
            {column ? 'Save' : 'Add column'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
