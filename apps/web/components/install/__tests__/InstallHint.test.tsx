import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { InstallHint } from '../InstallHint';

// The server does not know the device, so it renders nothing; the hint appears after mount on a phone.
describe('InstallHint', () => {
  it('renders nothing on the server', () => {
    expect(renderToStaticMarkup(<InstallHint />)).toBe('');
  });
});
