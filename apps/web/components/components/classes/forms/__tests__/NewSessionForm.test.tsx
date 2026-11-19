import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { NewSessionForm } from '@/components/components/classes/forms';

vi.mock('@/actions/classes', () => ({ createSessionAction: vi.fn() }));

describe('NewSessionForm: a session is a date range', () => {
  it('asks for a name, a description and a first and last day, picked as dates', () => {
    const html = renderToStaticMarkup(<NewSessionForm variant="dialog" onCancel={() => undefined} />);
    expect(html).toContain('Session name *');
    expect(html).toContain('Description');
    expect(html).toContain('name="startsOn"');
    expect(html).toContain('name="endsOn"');
    expect(html).toContain('type="date"');
    expect(html).toContain('Create session');
  });

  it('has no time, camp size, location, instructor or ratio fields', () => {
    const html = renderToStaticMarkup(<NewSessionForm variant="dialog" onCancel={() => undefined} />);
    expect(html).not.toContain('datetime-local');
    expect(html).not.toContain('Instructor ratio');
    expect(html).not.toContain('Camp Size');
    expect(html).not.toContain('Location');
  });
});
