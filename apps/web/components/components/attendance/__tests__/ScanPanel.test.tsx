import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ScanPanel } from '@/components/components/attendance';

describe('ScanPanel', () => {
  it('shows the scan field and one closed camera button, with no second start or close control', () => {
    const html = renderToStaticMarkup(
      <ScanPanel scanRef={{ current: null }} disabled={false} onCode={() => undefined} />,
    );
    expect(html).toContain('class="scan-panel"');
    expect(html).toContain('Scan a badge, or type a code');
    expect(html).toContain('Scan with camera');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-controls="camera-scanner"');
    expect(html).not.toContain('Start camera');
    expect(html).not.toContain('Close camera');
  });
});
