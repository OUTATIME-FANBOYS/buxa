import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { CustomField, RegistrationDocument } from '@buxa/contracts';
import { RegisterForm } from '../RegisterForm';
import { DocumentReviewList } from '../DocumentReviewList';

vi.mock('@/actions/registration', () => ({
  createFormAction: vi.fn(),
  updateFormAction: vi.fn(),
  removeFormFileAction: vi.fn(),
  reviewDocumentAction: vi.fn(),
  submitRegistrationAction: vi.fn(),
}));

const SESSION_ART = { id: '11111111-1111-4111-8111-111111111111', name: 'Art', series: [] };
const FILE = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Blank form.pdf',
  contentType: 'application/pdf',
  sizeBytes: 900,
};
const FORM = '33333333-3333-4333-8333-333333333333';

const documentQuestion: CustomField = {
  kind: 'document',
  key: 'immunization',
  label: 'Immunization record',
  required: true,
};

describe('RegisterForm: document questions and the forms to download', () => {
  const html = renderToStaticMarkup(
    <RegisterForm
      formId={FORM}
      sessions={[SESSION_ART]}
      campers={[]}
      timeZone="UTC"
      clockFormat="24h"
      fields={[documentQuestion]}
      attachments={[FILE]}
      variant="dialog"
    />,
  );

  it('asks for a file for a document question, named like the other answers', () => {
    expect(html).toContain('type="file"');
    expect(html).toContain('name="custom.immunization"');
    expect(html).toContain('accept="application/pdf,image/jpeg,image/png,image/webp"');
    expect(html).toContain('Immunization record');
  });

  it('links each form to download for the session the family is registering for (the form first session before a choice)', () => {
    expect(html).toContain('Forms to download');
    expect(html).toContain(`/camp/registration/files/${FILE.id}?session=${SESSION_ART.id}`);
    expect(html).toContain('>Blank form.pdf<');
  });
});

describe('DocumentReviewList: a document per question, with its review', () => {
  it('says Not received for a question with no file, and offers a review only where a file was sent', () => {
    const documents: RegistrationDocument[] = [
      { fieldKey: 'immunization', label: 'Immunization record', fileId: null, fileName: null, status: 'not_received' },
      { fieldKey: 'medical', label: 'Medical form', fileId: FILE.id, fileName: 'medical.pdf', status: 'pending' },
    ];
    const html = renderToStaticMarkup(<DocumentReviewList formId={FORM} documents={documents} />);

    expect(html).toContain('Not received');
    expect(html.match(/name="status"/g)).toHaveLength(1);
    expect(html).toContain(`name="fileId" value="${FILE.id}"`);
    expect(html).toContain(`/camp/registration/documents/${FILE.id}`);
    expect(html).toContain('Needs replacing');
  });

  it('draws nothing when a form has no document questions', () => {
    expect(renderToStaticMarkup(<DocumentReviewList formId={FORM} documents={[]} />)).toBe('');
  });
});
