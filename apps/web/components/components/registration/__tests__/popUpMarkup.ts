import { act, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';

/*
 * A pop-up (Dialog) portals into document.body, which the server renderer cannot do. Its markup is read from the browser DOM
 * instead. A test file that uses this must run under jsdom (`// @vitest-environment jsdom`).
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

export function popUpMarkup(element: ReactElement): string {
  const host = document.body.appendChild(document.createElement('div'));
  const root = createRoot(host);
  act(() => {
    root.render(element);
  });
  const markup = document.body.innerHTML;
  act(() => {
    root.unmount();
  });
  host.remove();

  return markup;
}
