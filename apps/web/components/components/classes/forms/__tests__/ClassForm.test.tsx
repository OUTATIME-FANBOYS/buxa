import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// The form shows and converts times in the browser's zone. Tests run in Sydney so the saved instants read as the times below.
process.env.TZ = 'Australia/Sydney';
import type { Class } from '@buxa/contracts';
import { ClassForm } from '@/components/components/classes/forms';

vi.mock('@/actions/classes', () => ({ addClassAction: vi.fn(), updateClassAction: vi.fn() }));

const SESSION = '11111111-1111-4111-8111-111111111111';
const CLASS = '22222222-2222-4222-8222-222222222222';
const INSTRUCTOR = '33333333-3333-4333-8333-333333333333';

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
  price: null,
};

const render = (props: Partial<Parameters<typeof ClassForm>[0]> = {}) =>
  renderToStaticMarkup(
    <ClassForm sessionId={SESSION} sessionName="Summer camp" instructors={[]} {...props} />,
  );

describe('ClassForm: the fields of a class', () => {
  it('has the name, the three fields in one row (ages and Camp Size), the time range and the location', () => {
    const html = render();
    expect(html).toContain('Class name');
    expect(html).toContain('Youngest age');
    expect(html).toContain('Oldest age');
    expect(html).toContain('Camp Size');
    expect(html).toContain('name="startsAt"');
    expect(html).toContain('type="datetime-local"');
    expect(html).toContain('Location');
    // The three camp fields share one row (33% each).
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

  it('limits Camp Size to whole numbers from 3 to 30 in the form, with no hint text', () => {
    const html = render();
    const input = html.match(/<input[^>]*name="capacity"[^>]*>/)?.[0] ?? '';
    expect(input).toContain('min="3"');
    expect(input).toContain('max="30"');
    expect(html).not.toContain('A whole number from');
  });

  it('limits the youngest and oldest age to whole numbers from 3 to 20 in the form', () => {
    const html = render();
    for (const name of ['minAge', 'maxAge']) {
      const input = html.match(new RegExp(`<input[^>]*name="${name}"[^>]*>`))?.[0] ?? '';
      expect(input, name).toContain('min="3"');
      expect(input, name).toContain('max="20"');
    }
  });

  it('shows the instructors as a dropdown and a scrolling tag box, with the label aligned with the others', () => {
    const html = render({ instructors: [{ id: INSTRUCTOR, name: 'Ana Ruiz' }] });
    expect(html).toContain('>Instructors</label>');
    expect(html).toContain('<select');
    expect(html).toContain('Add an instructor');
    expect(html).not.toContain('type="checkbox"');
  });

  it('starts the chosen instructors as tags, and posts each one as an instructorIds field', () => {
    const html = render({
      instructors: [
        { id: INSTRUCTOR, name: 'Ana Ruiz' },
        { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'Ben Cole' },
      ],
      cls: { ...cls, instructorIds: [INSTRUCTOR], instructors: [{ id: INSTRUCTOR, name: 'Ana Ruiz' }] },
    });
    expect(html).toContain('aria-label="Remove Ana Ruiz"');
    expect(html).toContain(`name="instructorIds" value="${INSTRUCTOR}"`);
    expect(html).not.toContain('name="instructorIds" value="bbbbbbbb');
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

  it('a dialog leaves its buttons to the dialog footer (tied by form id); a page has a Cancel link back to the session', () => {
    const dialog = render({ variant: 'dialog', formId: 'edit-form' });
    expect(dialog).toContain('id="edit-form"');
    expect(dialog).not.toContain('>Cancel<');
    expect(render()).toContain(`href="/camp/sessions/${SESSION}"`);
  });

  it('asks each required field once: one asterisk, and aria-required on the input', () => {
    const html = render();
    expect(html).not.toContain('* *');
    expect(html).not.toContain('Class name *');
    expect(html).toContain('field-required');
    expect(html).toContain('aria-required="true"');
  });
});

describe('ClassForm: a teacher edits the name only', () => {
  it('with detailsOnly, shows the name and nothing else the camp sets', () => {
    const html = render({ cls, detailsOnly: true });
    expect(html).toContain('Class name');
    expect(html).toContain('name="name"');
    for (const hidden of [
      'name="minAge"',
      'name="maxAge"',
      'name="capacity"',
      'name="startsAt"',
      'name="endsAt"',
      'name="location"',
    ]) {
      expect(html, hidden).not.toContain(hidden);
    }
    expect(html).not.toContain('Youngest age');
    expect(html).not.toContain('Location');
  });

  it('without detailsOnly, the camp manager sees every field', () => {
    const html = render({ cls });
    expect(html).toContain('name="location"');
    expect(html).toContain('name="capacity"');
  });
});
