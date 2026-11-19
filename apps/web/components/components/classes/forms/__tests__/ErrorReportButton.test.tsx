import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ErrorReportButton } from '@/components/components/classes/forms';

describe('ErrorReportButton', () => {
  it('is not shown when the preview has no refused rows', () => {
    expect(renderToStaticMarkup(<ErrorReportButton fileName="season.csv" text="x" refused={0} />)).toBe('');
  });

  it('is shown when the preview has refused rows, and posts the file text to the report route', () => {
    const html = renderToStaticMarkup(<ErrorReportButton fileName="season.csv" text={'a,"b"\r\n'} refused={3} />);
    expect(html).toContain('Download error report');
    expect(html).toContain('method="post"');
    expect(html).toContain('action="/camp/classes/import/error-report"');
    expect(html).toContain('name="fileName" value="season.csv"');
    expect(html).toContain('name="csv" value="a,&quot;b&quot;');
  });
});
