import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ImportForm } from '@/components/components/classes/forms';

vi.mock('@buxa/server/composers/index', () => ({ importClassesAction: vi.fn() }));

describe('ImportForm', () => {
  it('starts with the upload step only: a labelled CSV file input, and nothing to confirm', () => {
    const html = renderToStaticMarkup(<ImportForm />);
    expect(html).toContain('<span class="field-label">CSV file *</span>');
    expect(html).toContain('type="file"');
    expect(html).toContain('accept=".csv,text/csv"');
    expect(html).toContain('Check the file');
    expect(html).not.toContain('Save ');
    expect(html).not.toContain('name="csv"');
  });
});
