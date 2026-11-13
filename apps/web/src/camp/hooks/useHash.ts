import { useEffect, useState } from 'react';

/** The current URL hash, updating when it changes. The one hash hook for the whole app. */
export function useHash(): string {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const onChange = () => setHash(location.hash);
    addEventListener('hashchange', onChange);
    return () => removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}
