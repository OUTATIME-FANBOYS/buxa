import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { StatusPill } from '@/components/components/attendance/export';

describe('StatusPill', () => {
  it('shows a status as its words', () => {
    expect(renderToStaticMarkup(<StatusPill status="valid" />)).toContain('pill');
  });
  it('shows nothing when there is no status', () => {
    expect(renderToStaticMarkup(<StatusPill status={null} />)).toBe('');
  });
});
