import Link from 'next/link';
import { ROUTES, assignPath, groupsPath, sessionPath } from '@/config/routes';
import { Button } from '@/components/elements';

/** The session's breadcrumb, and the links between its Groups and rooms page and its Assign page. */
export function SessionNav({
  sessionId,
  sessionName,
  current,
}: {
  sessionId: string;
  sessionName: string;
  current: 'groups' | 'assign';
}) {
  return (
    <>
      <nav aria-label="Breadcrumb" className="muted">
        <Link className="link" href={ROUTES.sessions}>
          Sessions
        </Link>{' '}
        /{' '}
        <Link className="link" href={sessionPath(sessionId)}>
          {sessionName}
        </Link>{' '}
        / {current === 'groups' ? 'Groups and rooms' : 'Assign people'}
      </nav>
      <nav aria-label="Session pages" className="classes-actions">
        <Button variant={current === 'groups' ? 'secondary' : 'ghost'} size="sm" href={groupsPath(sessionId)}>
          Groups and rooms
        </Button>
        <Button variant={current === 'assign' ? 'secondary' : 'ghost'} size="sm" href={assignPath(sessionId)}>
          Assign people
        </Button>
      </nav>
    </>
  );
}
