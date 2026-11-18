import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CancelEnrolmentButton } from '@/components/components/classes/forms/export';

vi.mock('@buxa/server/composers/index', () => ({ cancelEnrolmentAction: vi.fn() }));

describe('CancelEnrolmentButton', () => {
  it('names the camper on the button for a screen reader, and carries the ids it posts', () => {
    const html = renderToStaticMarkup(
      <CancelEnrolmentButton classId="c1" enrolmentId="e1" camperName="Ada Lovelace" />,
    );
    expect(html).toContain('Cancel enrolment');
    expect(html).toContain('for Ada Lovelace');
    expect(html).toContain('name="enrolmentId" value="e1"');
    expect(html).toContain('name="classId" value="c1"');
  });
});
