import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { FormEditor } from '../FormEditor';
import { RegisterForm } from '../RegisterForm';

vi.mock('@/actions/registration', () => ({
  createFormAction: vi.fn(),
  updateFormAction: vi.fn(),
  removeFormFileAction: vi.fn(),
  reviewDocumentAction: vi.fn(),
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

  it('offers the children from People as a search with an Add a person link, not a checkbox list, before any class', () => {
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
    expect(html).toContain('aria-label="Search children"');
    expect(html).toContain('href="/camp/people/new"');
    expect(html).toContain('>Add a person<');
    expect(html).not.toContain('check-group');
    expect(html).not.toContain('type="checkbox"');
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

describe('FormEditor: the fields only, the pop-up footer holds the buttons', () => {
  it('marks the form name and sessions once, and draws no fieldset', () => {
    const html = renderToStaticMarkup(
      <FormEditor
        mode="edit"
        id="f-1"
        formId="f-1"
        sessions={SESSIONS}
        initial={{ name: 'Reg Kids', sessionIds: [], fields: [], attachments: [] }}
      />,
    );
    expect(html).not.toContain('<fieldset');
    expect(html).not.toContain('* *');
    expect(html).not.toContain('Form name *');
    expect(html).toContain('Form name');
    expect(html).toContain('Sessions this form covers');
    expect(html).toContain('<form noValidate=""');
  });

  it('has no buttons of its own: Save draft, Publish and Cancel belong to the pop-up footer', () => {
    const edit = renderToStaticMarkup(
      <FormEditor
        mode="edit"
        id="f-1"
        formId="f-1"
        sessions={SESSIONS}
        initial={{ name: 'Reg Kids', sessionIds: [], fields: [], attachments: [] }}
      />,
    );
    expect(edit).not.toContain('Save draft');
    expect(edit).not.toContain('Cancel');
    const create = renderToStaticMarkup(<FormEditor mode="create" id="new-form" sessions={SESSIONS} />);
    expect(create).not.toContain('Create form');
    expect(create).toContain('id="new-form"');
  });

  it('marks a create as a pop-up create, so the action returns instead of redirecting', () => {
    const create = renderToStaticMarkup(<FormEditor mode="create" id="new-form" sessions={SESSIONS} />);
    expect(create).toContain('name="dialog" value="1"');
    const edit = renderToStaticMarkup(
      <FormEditor
        mode="edit"
        id="f-1"
        formId="f-1"
        sessions={SESSIONS}
        initial={{ name: 'Reg Kids', sessionIds: [], fields: [], attachments: [] }}
      />,
    );
    expect(edit).not.toContain('name="dialog"');
  });
});
