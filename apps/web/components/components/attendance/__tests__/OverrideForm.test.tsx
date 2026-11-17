import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { OverrideForm } from '@/components/components/attendance/export';

describe('OverrideForm', () => {
  it('asks for a reason and keeps the submit disabled until one is written', () => {
    const html = renderToStaticMarkup(<OverrideForm busy={false} onSubmit={() => undefined} />);
    expect(html).toContain('Reason for overriding (required)');
    expect(html).toContain('aria-label="Override this refusal"');
    expect(html).toMatch(/<button type="submit"[^>]*disabled=""/);
  });
});
