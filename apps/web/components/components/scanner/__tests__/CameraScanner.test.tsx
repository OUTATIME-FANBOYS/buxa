import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CameraScanner } from '@/components/components/scanner';

describe('CameraScanner', () => {
  it('renders no buttons of its own before the camera is started: the parent owns open and close', () => {
    const html = renderToStaticMarkup(<CameraScanner onScan={() => undefined} />);
    expect(html).not.toContain('<button');
    expect(html).not.toContain('Start camera');
    expect(html).not.toContain('Close camera');
    expect(html).not.toContain('<video');
  });
});
