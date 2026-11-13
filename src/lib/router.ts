import { useEffect, useState } from 'react';

export type Route =
  | { name: 'dashboard' } | { name: 'my-tasks' } | { name: 'projects' } | { name: 'board'; id?: string }
  | { name: 'calendar' } | { name: 'team' } | { name: 'agents' } | { name: 'reports' } | { name: 'settings' } | { name: 'notfound'; path: string };

export function parseHash(h: string): Route {
  const path = h.replace(/^#\/?/, '').split('?')[0];
  const [a, b] = path.split('/');
  switch (a) {
    case '': case 'dashboard': return { name: 'dashboard' };
    case 'my-tasks': return { name: 'my-tasks' };
    case 'projects': return { name: 'projects' };
    case 'board': return { name: 'board', id: b };
    case 'calendar': return { name: 'calendar' };
    case 'team': return { name: 'team' };
    case 'agents': return { name: 'agents' };
    case 'reports': return { name: 'reports' };
    case 'settings': return { name: 'settings' };
    default: return { name: 'notfound', path };
  }
}
export const navigate = (to: string) => { location.hash = to; };
export function useRoute(): Route {
  const [r, setR] = useState(() => parseHash(location.hash));
  useEffect(() => {
    const f = () => setR(parseHash(location.hash));
    addEventListener('hashchange', f); return () => removeEventListener('hashchange', f);
  }, []);
  return r;
}
