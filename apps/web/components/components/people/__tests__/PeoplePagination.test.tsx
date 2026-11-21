import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PeoplePagination } from '@/components/components/people';

const base = { params: { q: 'Lee', role: 'camper' as const, page: 1 }, from: 1, to: 25, total: 143, pageCount: 6 };

/** The Previous and Next buttons: a disabled button, or a link to the other page. */
const control = (html: string, label: string) => {
  const link = html.match(new RegExp(`<a[^>]*href="([^"]*)"[^>]*>${label}</a>`));
  const button = html.match(new RegExp(`<button[^>]*disabled=""[^>]*>${label}</button>`));

  return { disabled: button !== null, href: link?.[1]?.replaceAll('&amp;', '&') };
};

describe('PeoplePagination', () => {
  it('disables Previous on the first page and links Next to the second', () => {
    const html = renderToStaticMarkup(<PeoplePagination {...base} page={1} />);
    expect(control(html, 'Previous').disabled).toBe(true);
    expect(control(html, 'Next')).toEqual({ disabled: false, href: '/camp/people?page=2&q=Lee&role=camper' });
  });

  it('disables Next on the last page and links Previous back to the one before', () => {
    const html = renderToStaticMarkup(<PeoplePagination {...base} page={6} from={126} to={143} />);
    expect(control(html, 'Next').disabled).toBe(true);
    expect(control(html, 'Previous')).toEqual({ disabled: false, href: '/camp/people?page=5&q=Lee&role=camper' });
  });

  it('enables both buttons on a middle page', () => {
    const html = renderToStaticMarkup(<PeoplePagination {...base} page={3} from={51} to={75} />);
    expect(control(html, 'Previous').disabled).toBe(false);
    expect(control(html, 'Next').disabled).toBe(false);
  });

  it('shows the range, the total and the page label, centred in a labelled bar', () => {
    const html = renderToStaticMarkup(<PeoplePagination {...base} page={2} from={26} to={50} />);
    expect(html).toContain('Showing 26 to 50 of 143 people');
    expect(html).toContain('Page 2 of 6');
    expect(html).toContain('aria-label="People pages"');
  });

  it('uses the singular for one person', () => {
    const html = renderToStaticMarkup(
      <PeoplePagination params={base.params} page={1} pageCount={1} from={1} to={1} total={1} />,
    );
    expect(html).toContain('Showing 1 to 1 of 1 person');
    expect(control(html, 'Previous').disabled).toBe(true);
    expect(control(html, 'Next').disabled).toBe(true);
  });
});
