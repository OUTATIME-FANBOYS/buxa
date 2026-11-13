'use client';

/** Shown when something unexpected breaks while rendering. The message is for the person; the error goes to the console. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  console.error(error);
  return (
    <main className="auth"><div className="auth-card">
      <h1>Something went wrong</h1>
      <p className="muted">Reloading usually fixes this. If it keeps happening, tell us what you were doing.</p>
      {error.digest && <p className="muted small">Reference: {error.digest}</p>}
      <button className="btn btn-primary" onClick={reset}>Try again</button>
    </div></main>
  );
}
