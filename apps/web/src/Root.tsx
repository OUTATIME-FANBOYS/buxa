import { Suspense, lazy, useEffect } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useHash } from './camp/hooks/useHash';
import { go, isCampHash, isEmptyHash } from './camp/lib/routing';

// Each area is its own chunk, so the sign-in page does not download the whole kanban app and vice versa.
const CampApp = lazy(() => import('./camp/screens/CampApp').then(m => ({ default: m.CampApp })));
const KanbanApp = lazy(() => import('./App'));

/** The camp area lives at #/camp (and the bare address). Every older hash still opens the original kanban app. */
export default function Root() {
  const hash = useHash();
  useEffect(() => { if (isEmptyHash(hash)) go('/camp'); }, [hash]);
  return (
    <ErrorBoundary>
      <Suspense fallback={<p className="muted" role="status" style={{ padding: 24 }}>Loading…</p>}>
        {isCampHash(hash) ? <CampApp /> : <KanbanApp />}
      </Suspense>
    </ErrorBoundary>
  );
}
