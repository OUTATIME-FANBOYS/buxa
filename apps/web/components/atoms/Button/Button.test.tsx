import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Button } from '@/components/elements';

describe('Button', () => {
  it('renders the default as the secondary variant, a submit button, in the md size', () => {
    const html = renderToStaticMarkup(<Button>Cancel</Button>);
    expect(html).toMatch(/<button[^>]*class="button button--secondary"[^>]*>Cancel<\/button>/);
    expect(html).toContain('type="submit"');
  });

  it.each([
    ['primary', 'button--primary'],
    ['secondary', 'button--secondary'],
    ['ghost', 'button--ghost'],
    ['danger', 'button--danger'],
    ['danger-soft', 'button--danger-soft'],
  ] as const)('maps the %s variant to its button class', (variant, cls) => {
    expect(renderToStaticMarkup(<Button variant={variant}>Go</Button>)).toContain(cls);
  });

  it('leads with a named icon before the label', () => {
    const html = renderToStaticMarkup(
      <Button variant="primary" icon="plus">
        New task
      </Button>,
    );
    expect(html).toMatch(/<svg[\s\S]*?<\/svg>New task<\/button>/);
    expect(html).not.toContain('button--icon-only');
  });

  it('renders an icon-only button as a round button with its accessible name', () => {
    const html = renderToStaticMarkup(<Button iconOnly icon="x" aria-label="Close" />);
    expect(html).toContain('button--icon-only');
    expect(html).toMatch(/<button[^>]*aria-label="Close"/);
    expect(html).toContain('<svg');
  });

  it('keeps the header and large sizes as semantic classes', () => {
    expect(
      renderToStaticMarkup(
        <Button variant="primary" size="header">
          Add task
        </Button>,
      ),
    ).toContain('button--header');
    expect(renderToStaticMarkup(<Button variant="primary">Add task</Button>)).not.toContain('button--header');
    expect(
      renderToStaticMarkup(
        <Button variant="primary" size="lg">
          Check in
        </Button>,
      ),
    ).toContain('button--lg');
  });

  it('renders a link with the same classes when given an href', () => {
    const html = renderToStaticMarkup(
      <Button variant="ghost" href="/x">
        Next
      </Button>,
    );
    expect(html).toMatch(/<a class="button button--ghost" href="\/x">Next<\/a>/);
  });
});
