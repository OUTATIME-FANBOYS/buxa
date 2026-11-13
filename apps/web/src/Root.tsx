import { useEffect, useState } from 'react';
import App, { ErrorBoundary } from './App';
import { CampApp } from './camp/screens';
import { isCampHash } from './camp/lib';

/** The camp area lives at #/camp (and the empty hash). Every older hash still opens the original kanban app. */
export default function Root() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => { const f = () => setHash(location.hash); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  useEffect(() => { if (hash === '' || hash === '#' || hash === '#/') location.replace('#/camp'); }, [hash]);
  return <ErrorBoundary>{isCampHash(hash) ? <CampApp /> : <App />}</ErrorBoundary>;
}
