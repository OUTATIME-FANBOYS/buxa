'use client';

import { Empty } from '@/components/ui';

/** Shown inside the page frame when a page could not load. The message is for the person; the error goes to the console. */
export function ErrorState({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  console.error(error);
  return (
    <div className="page">
      <Empty icon="alert" title="Could not load this"
        body={error.digest ? `Something went wrong on our side. Reference: ${error.digest}` : 'Something went wrong on our side.'}
        action={<button className="btn" onClick={reset}>Try again</button>} />
    </div>
  );
}
