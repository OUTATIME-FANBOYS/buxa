import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ContactDetails } from '@/components/components/people';

describe('ContactDetails', () => {
  it('shows the date of birth with the minor note, the email and the phone', () => {
    const html = renderToStaticMarkup(
      <ContactDetails
        person={{ dateOfBirth: '2012-05-01', email: 'kid@example.com', phone: '555 0100', isMinor: true }}
      />,
    );
    expect(html).toContain('<dt>Date of birth</dt><dd>1 May 2012 (under 18)</dd>');
    expect(html).toContain('<dt>Email</dt><dd>kid@example.com</dd>');
    expect(html).toContain('<dt>Phone</dt><dd>555 0100</dd>');
  });
  it('leaves out what is not recorded or not visible to this reader', () => {
    expect(
      renderToStaticMarkup(<ContactDetails person={{ dateOfBirth: null, email: null, phone: null, isMinor: null }} />),
    ).toBe('');
    const html = renderToStaticMarkup(
      <ContactDetails person={{ dateOfBirth: null, email: null, phone: '555 0100', isMinor: null }} />,
    );
    expect(html).not.toContain('Email');
    expect(html).toContain('Phone');
  });
});
