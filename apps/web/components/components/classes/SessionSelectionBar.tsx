'use client';

import { Button } from '@/components/elements';

/** The bar above the sessions table while one or more are selected: the count, Clear, and Delete selected. */
export function SessionSelectionBar({
  count,
  onClear,
  onDelete,
}: {
  count: number;
  onClear: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="session-selection">
      <p className="session-selection__count">{count} selected</p>
      <div className="classes-actions">
        <Button type="button" variant="glass" size="sm" onClick={onClear}>
          Clear
        </Button>
        <Button type="button" variant="glass-danger" size="sm" icon="trash" onClick={onDelete}>
          Delete selected
        </Button>
      </div>
    </div>
  );
}
