import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { NewClassForm } from '@/components/components/classes/forms/export';

vi.mock('@buxa/server/composers/index', () => ({ createClassAction: vi.fn() }));

describe('NewClassForm', () => {
  const html = renderToStaticMarkup(<NewClassForm />);

  it('ties every label to its input, so each field has a name for assistive technology', () => {
    for (const label of [
      'Class name *',
      'Description',
      'Youngest age *',
      'Oldest age *',
      'Default places *',
      'Instructors',
      'Campers',
    ]) {
      expect(html).toContain(`<span class="field-label">${label}</span>`);
    }
    expect(html).toContain('name="name"');
    expect(html).toContain('name="ratioInstructors"');
  });

  it('marks the required fields and explains the ratio is optional', () => {
    expect(html).toContain('Fields marked with an asterisk are required.');
    expect(html).toContain('Instructor ratio (optional)');
  });

  it('has a Create button and a way back to the list', () => {
    expect(html).toContain('Create class');
    expect(html).toContain('href="/camp/classes"');
  });

  it('in the dialog it has no panel and a Cancel button in place of the link back to the list', () => {
    const dialogHtml = renderToStaticMarkup(<NewClassForm variant="dialog" onCancel={() => {}} />);
    expect(dialogHtml).not.toContain('panel');
    expect(dialogHtml).toContain('Create class');
    expect(dialogHtml).toContain('>Cancel</button>');
    expect(dialogHtml).not.toContain('href="/camp/classes"');
  });
});
