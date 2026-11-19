import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Class } from '@buxa/contracts';
import { ClassesTable } from '@/components/components/classes';

const cls = (over: Partial<Class> = {}): Class => ({
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Robotics',
  description: '',
  ageRange: { minAge: 8, maxAge: 12 },
  capacity: 12,
  instructorRatio: { instructors: 1, campers: 8 },
  createdAt: '2027-07-01T00:00:00.000Z',
  ...over,
});

describe('ClassesTable', () => {
  it('links each class to its page and shows its ages, default places and ratio', () => {
    const html = renderToStaticMarkup(<ClassesTable classes={[cls()]} />);
    expect(html).toContain('href="/camp/classes/11111111-1111-4111-8111-111111111111"');
    expect(html).toContain('8 to 12');
    expect(html).toContain('1:8');
  });

  it('says when no instructor ratio is set', () => {
    expect(renderToStaticMarkup(<ClassesTable classes={[cls({ instructorRatio: null })]} />)).toContain('Not set');
  });
});
