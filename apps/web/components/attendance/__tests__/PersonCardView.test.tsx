import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PersonCard } from '@/logic/common';
import { PersonCardView } from '../PersonCardView';

const card = { person: { id: 'p-1', givenName: 'Ada', familyName: 'Lee', preferredName: null, status: 'valid', roles: [] }, onSiteSince: '2027-07-03T09:00:00.000Z' } as unknown as PersonCard;

describe('PersonCardView', () => {
  it('shows the name, the status and the time on site, with the action', () => {
    const html = renderToStaticMarkup(<PersonCardView card={card} timeZone="Europe/London"><button>Check in</button></PersonCardView>);
    expect(html).toContain('>Ada Lee</h2>');
    expect(html).toContain('On site since');
    expect(html).toContain('<button>Check in</button>');
  });
  it('leaves out the time on site when the person is not on site', () => {
    const html = renderToStaticMarkup(<PersonCardView card={{ ...card, onSiteSince: null }} timeZone="Europe/London"><span /></PersonCardView>);
    expect(html).not.toContain('On site since');
  });
});
