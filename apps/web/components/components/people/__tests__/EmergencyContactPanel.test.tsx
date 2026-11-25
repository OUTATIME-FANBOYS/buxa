import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Person } from '@buxa/contracts';
import { settle } from '@buxa/domain';
import { EmergencyContactPanel } from '@/components/components/people';

vi.mock('@buxa/server/composers/people/updateEmergencyContactAction', () => ({
  updateEmergencyContactAction: () => settle(() => ({ status: 'idle' })),
}));

const ID = '22222222-2222-4222-8222-222222222222';

type PanelPerson = Pick<Person, 'id' | 'roles' | 'emergencyContact' | 'canEditEmergencyContact'>;

const contact = { name: 'Mara Lee', phone: '+1 555 0100', relationship: 'Mother' };
const empty = { name: null, phone: null, relationship: null };

const panel = (over: Partial<PanelPerson>) =>
  renderToStaticMarkup(
    <EmergencyContactPanel
      person={{ id: ID, roles: ['camper'], emergencyContact: contact, canEditEmergencyContact: true, ...over }}
    />,
  );

describe('EmergencyContactPanel', () => {
  it('is titled Emergency contact on every person, staff or family or not, whatever the role', () => {
    for (const roles of [['camper'], ['guardian'], ['participant'], ['instructor']] as const) {
      expect(panel({ roles: [...roles] })).toContain('Emergency contact</h2>');
    }
  });

  it('shows the name, phone and relationship when the viewer may see them', () => {
    const html = panel({});
    expect(html).toContain('Mara Lee');
    expect(html).toContain('+1 555 0100');
    expect(html).toContain('Mother');
  });

  it('shows the Edit action only when the server says this viewer may edit it', () => {
    expect(panel({ canEditEmergencyContact: true })).toContain('>Edit</button>');
    expect(panel({ canEditEmergencyContact: false })).not.toContain('>Edit</button>');
  });

  it('says who can see it, and shows no values, to a viewer who may not see the contact', () => {
    const html = panel({ emergencyContact: null, canEditEmergencyContact: false });
    expect(html).toContain('Shown to staff and the family&#x27;s guardian only.');
    expect(html).not.toContain('Mara Lee');
    expect(html).not.toContain('Edit</button>');
  });

  it('shows the missing-contact note for a camper with no contact', () => {
    const html = panel({ roles: ['camper'], emergencyContact: empty });
    expect(html).toContain('Emergency contact is missing');
    expect(html).toContain('class="muted"');
  });

  it('does not show the missing note for a camper who has a name and a phone', () => {
    expect(panel({ roles: ['camper'], emergencyContact: contact })).not.toContain('Emergency contact is missing');
  });

  it('shows the missing note for a camper with only a name (not yet complete)', () => {
    const html = panel({ roles: ['camper'], emergencyContact: { name: 'Mara Lee', phone: null, relationship: null } });
    expect(html).toContain('Emergency contact is missing');
  });

  it('never shows the missing note to a non-camper: it says none is recorded instead', () => {
    const html = panel({ roles: ['participant'], emergencyContact: empty });
    expect(html).not.toContain('Emergency contact is missing');
    expect(html).toContain('No emergency contact recorded.');
  });
});
