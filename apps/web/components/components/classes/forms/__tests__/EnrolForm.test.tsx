import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { EnrolForm } from '@/components/components/classes/forms';

vi.mock('@buxa/server/composers/index', () => ({ enrolAction: vi.fn(), cancelEnrolmentAction: vi.fn() }));

const base = {
  classId: '11111111-1111-4111-8111-111111111111',
  sessionId: '22222222-2222-4222-8222-222222222222',
  campers: [{ id: '33333333-3333-4333-8333-333333333333', name: 'Ada Lovelace' }],
};

describe('EnrolForm', () => {
  it('offers both enrol and waitlist when the session has places', () => {
    const html = renderToStaticMarkup(<EnrolForm {...base} full={false} canOverride={false} />);
    expect(html).toContain('Enrol camper');
    expect(html).toContain('Add to waitlist');
    expect(html).toContain('<option value="33333333-3333-4333-8333-333333333333">Ada Lovelace</option>');
  });

  it('offers only the waitlist when the session is full, and says why', () => {
    const html = renderToStaticMarkup(<EnrolForm {...base} full canOverride={false} />);
    expect(html).not.toContain('Enrol camper');
    expect(html).toContain('This session is full. A camper can join the waitlist instead.');
    expect(html).toContain('Add to waitlist');
  });

  it('shows the override reason only to someone allowed to override', () => {
    expect(renderToStaticMarkup(<EnrolForm {...base} full={false} canOverride={false} />)).not.toContain(
      'Override reason',
    );
    expect(renderToStaticMarkup(<EnrolForm {...base} full={false} canOverride />)).toContain(
      'Override reason (admins only)',
    );
  });

  it('labels the camper field and says when there is no one to choose', () => {
    const html = renderToStaticMarkup(<EnrolForm {...base} campers={[]} full={false} canOverride={false} />);
    expect(html).toMatch(/data-slot="label"[^>]*>Camper \*</);
    expect(html).toContain('No campers in the camp yet');
    expect(html).toMatch(/<select[^>]*disabled/);
  });
});
