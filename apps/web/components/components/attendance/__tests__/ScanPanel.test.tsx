import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ScanPanel } from '@/components/components/attendance';

describe('ScanPanel', () => {
  it('shows the scan field and a closed camera toggle', () => {
    const html = renderToStaticMarkup(
      <ScanPanel scanRef={{ current: null }} disabled={false} onCode={() => undefined} />,
    );
    expect(html).toContain('class="scan-panel"');
    expect(html).toContain('Scan with camera');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('id="camera-scanner"');
  });
});
