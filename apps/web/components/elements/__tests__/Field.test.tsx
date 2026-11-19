import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Field } from '@/components/elements';

describe('Field', () => {
  it('wraps its control in a labelled field', () => {
    const html = renderToStaticMarkup(
      <Field label="Email">
        <input />
      </Field>,
    );
    expect(html).toMatch(/<label class="field [^"]*"><span class="field-label [^"]*">Email<\/span><input\/>/);
  });
  it('shows the hint when there is no error', () => {
    expect(
      renderToStaticMarkup(
        <Field label="x" hint="Optional">
          <input />
        </Field>,
      ),
    ).toMatch(/<span class="field-hint [^"]*">Optional<\/span>/);
  });
  it('shows the error as an alert and hides the hint', () => {
    const html = renderToStaticMarkup(
      <Field label="x" hint="Optional" error="Required.">
        <input />
      </Field>,
    );
    expect(html).toContain('role="alert">Required.</span>');
    expect(html).not.toContain('field-hint');
  });
});
