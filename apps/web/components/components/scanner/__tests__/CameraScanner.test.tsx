import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CameraScanner } from '@/components/components/scanner';

describe('CameraScanner', () => {
  it('offers to start the camera and to close it, before the camera has been asked for', () => {
    const html = renderToStaticMarkup(<CameraScanner onScan={() => undefined} onClose={() => undefined} />);
    expect(html).toContain('>Start camera</button>');
    expect(html).toContain('>Close camera</button>');
    expect(html).not.toContain('<video');
  });
});
