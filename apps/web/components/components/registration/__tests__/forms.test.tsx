import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { FormEditor } from '../FormEditor';
import { RegisterForm } from '../RegisterForm';

vi.mock('@/actions/registration', () => ({
  createFormAction: vi.fn(),
  updateFormAction: vi.fn(),
  submitRegistrationAction: vi.fn(),
}));

const SESSIONS = [
  { id: 's-1', name: 'Art', classes: [] },
  { id: 's-2', name: 'Robotics', classes: [] },
];

const CAMPERS = [{ id: 'c-1', name: 'Ada Lovelace' }];

describe('RegisterForm: sections, one asterisk, no fieldsets', () => {
  it('draws each group as a heading and a section, never a fieldset box', () => {
    const html = renderToStaticMarkup(
      <RegisterForm
        formId="f-1"
        sessions={SESSIONS}
        campers={CAMPERS}
        timeZone="UTC"
        clockFormat="24h"
        fields={[]}
        variant="dialog"
      />,
    );
    expect(html).not.toContain('<fieldset');
    expect(html).not.toContain('<legend');
    expect(html).toContain('Parent or guardian');
    expect(html).toContain('Emergency contact');
  });

  it('asks each required question once: one asterisk, never a double one', () => {
    const html = renderToStaticMarkup(
      <RegisterForm
        formId="f-1"
        sessions={SESSIONS}
        campers={CAMPERS}
        timeZone="UTC"
        clockFormat="24h"
        fields={[]}
        variant="dialog"
      />,
    );
    expect(html).not.toContain('* *');
    expect(html).not.toContain('First name *');
    expect(html).not.toContain('Name *');
    expect(html).toContain('First name');
    // Sessions, first name, last name, date of birth, guardian name and email and phone, emergency name and phone (required ones).
    expect(html.match(/class="field-required"/g)?.length).toBeGreaterThan(0);
    expect(html).toContain('aria-required="true"');
  });

  it('turns off the browser bubbles, so the app shows its own errors', () => {
    const html = renderToStaticMarkup(
      <RegisterForm
        formId="f-1"
        sessions={SESSIONS}
        campers={CAMPERS}
        timeZone="UTC"
        clockFormat="24h"
        fields={[]}
        variant="dialog"
      />,
    );
    expect(html).toContain('<form noValidate=""');
  });

  it('leaves the buttons to the dialog footer in a dialog, tied by id', () => {
    const html = renderToStaticMarkup(
      <RegisterForm
        formId="f-1"
        id="take-form"
        sessions={SESSIONS}
        campers={CAMPERS}
        timeZone="UTC"
        clockFormat="24h"
        fields={[]}
        variant="dialog"
      />,
    );
    expect(html).toContain('id="take-form"');
    expect(html).not.toContain('Record registration');
  });

  it('lists the children to choose from People, as checkboxes, before any class', () => {
    const html = renderToStaticMarkup(
      <RegisterForm
        formId="f-1"
        sessions={SESSIONS}
        campers={CAMPERS}
        timeZone="UTC"
        clockFormat="24h"
        fields={[]}
        variant="dialog"
      />,
    );
    expect(html).toContain('check-group');
    expect(html).toContain('>Ada Lovelace<');
    expect(html).not.toContain('name="selections"');
  });

  it('says what to do when no child is in People yet', () => {
    const html = renderToStaticMarkup(
      <RegisterForm
        formId="f-1"
        sessions={SESSIONS}
        campers={[]}
        timeZone="UTC"
        clockFormat="24h"
        fields={[]}
        variant="dialog"
      />,
    );
    expect(html).toContain('No children are in People yet');
  });
});

describe('FormEditor: sections, one asterisk, glass Cancel and Save draft', () => {
  it('marks the form name and sessions once, and draws no fieldset', () => {
    const html = renderToStaticMarkup(
      <FormEditor
        mode="edit"
        formId="f-1"
        sessions={SESSIONS}
        initial={{ name: 'Reg Kids', season: null, sessionIds: [], fields: [] }}
      />,
    );
    expect(html).not.toContain('<fieldset');
    expect(html).not.toContain('* *');
    expect(html).not.toContain('Form name *');
    expect(html).toContain('Form name');
    expect(html).toContain('Sessions this form covers');
    expect(html).toContain('<form noValidate=""');
  });

  it('uses the glass variant for Save draft on the edit page, and the primary for Create form', () => {
    const edit = renderToStaticMarkup(
      <FormEditor
        mode="edit"
        formId="f-1"
        sessions={SESSIONS}
        initial={{ name: 'Reg Kids', season: null, sessionIds: [], fields: [] }}
      />,
    );
    expect(edit).toContain('button--glass');
    expect(edit).toContain('Save draft');
    const create = renderToStaticMarkup(<FormEditor mode="create" sessions={SESSIONS} />);
    expect(create).toContain('button--primary');
    expect(create).toContain('Create form');
  });

  it('leaves the buttons to the dialog footer in a dialog', () => {
    const html = renderToStaticMarkup(<FormEditor mode="create" variant="dialog" id="new-form" sessions={SESSIONS} />);
    expect(html).toContain('id="new-form"');
    expect(html).not.toContain('Create form');
  });
});
