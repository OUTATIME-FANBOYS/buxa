import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TeacherInviteFields } from '../AddTeacherDialog';

const empty = { name: '', email: '', phone: '' };
const noop = () => undefined;

describe('Add a teacher fields', () => {
  it('marks Name and Email as required with one red asterisk each, and leaves Phone optional', () => {
    const html = renderToStaticMarkup(<TeacherInviteFields values={empty} errors={{}} onChange={noop} />);

    expect(html).toMatch(/<label[^>]*>Name<span[^>]*field-required[^>]*>/);
    expect(html).toMatch(/<label[^>]*>Email<span[^>]*field-required[^>]*>/);
    expect(html.match(/field-required/g)).toHaveLength(2);
    expect(html).not.toMatch(/<label[^>]*>Phone<span[^>]*field-required/);
    expect(html).toContain('Optional');
  });

  it('shows the error state on the field that failed, and not on the others', () => {
    const html = renderToStaticMarkup(
      <TeacherInviteFields values={empty} errors={{ email: 'Enter an email address' }} onChange={noop} />,
    );

    expect(html).toContain('Enter an email address');
    expect(html.match(/aria-invalid="true"/g)).toHaveLength(1);
    expect(html).toContain('role="alert"');
  });

  it('shows no error state before anything is wrong', () => {
    const html = renderToStaticMarkup(<TeacherInviteFields values={empty} errors={{}} onChange={noop} />);

    expect(html).not.toContain('aria-invalid');
    expect(html).not.toContain('role="alert"');
  });
});
