import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CancelEnrolmentButton } from '@/components/components/classes/forms';

vi.mock('@buxa/server/composers/index', () => ({ cancelEnrolmentAction: vi.fn() }));

describe('CancelEnrolmentButton', () => {
  it('names the camper on the button for a screen reader, and carries the ids it posts', () => {
    const html = renderToStaticMarkup(
      <CancelEnrolmentButton classId="c1" enrolmentId="e1" camperName="Ada Lovelace" />,
    );
    expect(html).toContain('Withdraw');
    expect(html).toContain('aria-label="Withdraw Ada Lovelace"');
    expect(html).toContain('name="enrolmentId" value="e1"');
    expect(html).toContain('name="classId" value="c1"');
  });
});
