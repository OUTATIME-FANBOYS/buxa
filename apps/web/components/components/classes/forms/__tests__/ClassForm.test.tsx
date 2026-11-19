import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Class } from '@buxa/contracts';
import { campInputValue, ClassForm } from '@/components/components/classes/forms';

vi.mock('@/actions/classes', () => ({ addClassAction: vi.fn(), updateClassAction: vi.fn() }));

const SESSION = '11111111-1111-4111-8111-111111111111';
const CLASS = '22222222-2222-4222-8222-222222222222';

const cls: Class = {
  id: CLASS,
  sessionId: SESSION,
  sessionName: 'Summer camp',
  name: 'Robotics',
  ageRange: { minAge: 8, maxAge: 12 },
  capacity: 12,
  startsAt: '2027-07-04T23:00:00.000Z',
  endsAt: '2027-07-05T02:00:00.000Z',
  location: 'Lab 1',
  instructorIds: [],
  instructors: [],
  seatsTaken: 0,
  waitlisted: 0,
};

const render = (props: Partial<Parameters<typeof ClassForm>[0]> = {}) =>
  renderToStaticMarkup(
    <ClassForm sessionId={SESSION} sessionName="Summer camp" timeZone="Australia/Sydney" instructors={[]} {...props} />,
  );

describe('ClassForm: the fields of a class', () => {
  it('has the name, the three fields in one row (ages and Camp Size), the time range and the location', () => {
    const html = render();
    expect(html).toContain('Class name *');
    expect(html).toContain('Youngest age *');
    expect(html).toContain('Oldest age *');
    expect(html).toContain('Camp Size *');
    expect(html).toContain('name="startsAt"');
    expect(html).toContain('type="datetime-local"');
    expect(html).toContain('Location *');
    // The three camp fields share one row.
    const row = html.slice(html.indexOf('Youngest age'), html.indexOf('name="startsAt"'));
    expect(row).toContain('Camp Size');
  });

  it('removes the instructor ratio and the old default places label', () => {
    const html = render();
    expect(html).not.toContain('Instructor ratio');
    expect(html).not.toContain('ratioInstructors');
    expect(html).not.toContain('ratioCampers');
    expect(html).not.toContain('Default places');
    expect(html).not.toContain('Description');
  });

  it('limits Camp Size to whole numbers from 3 to 30 in the form', () => {
    const html = render();
    const input = html.match(/<input[^>]*name="capacity"[^>]*>/)?.[0] ?? '';
    expect(input).toContain('min="3"');
    expect(input).toContain('max="30"');
  });
});

describe('ClassForm: adding and editing', () => {
  it('adds a class to the session when no class is given', () => {
    const html = render();
    expect(html).toContain('Add class');
    expect(html).toContain(`name="sessionId" value="${SESSION}"`);
    expect(html).not.toContain('name="classId"');
  });

  it('edits a class: it carries the class id and starts with the saved values, in camp time', () => {
    const html = render({ cls });
    expect(html).toContain('Save class');
    expect(html).toContain(`name="classId" value="${CLASS}"`);
    expect(html).toContain('value="Robotics"');
    expect(html).toContain('value="8"');
    expect(html).toContain('value="2027-07-05T09:00"');
  });

  it('a dialog has a Cancel button, and a page has a Cancel link back to the session', () => {
    expect(render({ variant: 'dialog', onCancel: () => undefined })).toContain('>Cancel<');
    expect(render()).toContain(`href="/camp/classes/${SESSION}"`);
  });
});

describe('campInputValue', () => {
  it('reads an instant as the camp clock, the format the server parses', () => {
    expect(campInputValue('2027-07-04T23:00:00.000Z', 'Australia/Sydney')).toBe('2027-07-05T09:00');
    expect(campInputValue('2027-07-05T02:00:00.000Z', 'Australia/Sydney')).toBe('2027-07-05T12:00');
  });
});
