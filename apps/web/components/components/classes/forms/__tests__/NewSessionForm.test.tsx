import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { NewSessionForm } from '@/components/components/classes/forms';

vi.mock('@buxa/server/composers/index', () => ({ addSessionAction: vi.fn() }));

const base = {
  classId: '11111111-1111-4111-8111-111111111111',
  className: 'Robotics',
  defaultCapacity: 12,
  timeZone: 'Australia/Sydney',
  ratio: { instructors: 1, campers: 8 },
};

describe('NewSessionForm', () => {
  it('says which time zone the times are in, and shows the class ratio it is stored with', () => {
    const html = renderToStaticMarkup(<NewSessionForm {...base} instructors={[]} />);
    expect(html).toContain('Australia/Sydney');
    expect(html).toContain('1 instructor for 8 campers');
    expect(html).toContain('2027-07-05T09:00');
  });

  it('shows the class default as the places hint, when places are left empty', () => {
    expect(renderToStaticMarkup(<NewSessionForm {...base} instructors={[]} />)).toContain('(12)');
  });

  it('lists instructors as checkboxes, each with its name', () => {
    const html = renderToStaticMarkup(
      <NewSessionForm {...base} instructors={[{ id: '88888888-8888-4888-8888-888888888888', name: 'Ana Ruiz' }]} />,
    );
    expect(html).toContain('name="instructorIds" value="88888888-8888-4888-8888-888888888888"');
    expect(html).toContain('Ana Ruiz');
  });

  it('says so when nobody has the instructor role yet', () => {
    expect(renderToStaticMarkup(<NewSessionForm {...base} instructors={[]} />)).toContain(
      'No one has the instructor role yet.',
    );
  });

  it('says when the class has no ratio', () => {
    expect(renderToStaticMarkup(<NewSessionForm {...base} ratio={null} instructors={[]} />)).toContain(
      'not set on this class',
    );
  });
});
