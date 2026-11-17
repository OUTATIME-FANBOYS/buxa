import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppProviders } from '../AppProviders';
import { useUi } from '@/providers/UiProvider';

function Probe() { useUi(); return <p>uses ui</p>; }

describe('AppProviders', () => {
  it('provides the ui context (toasts, confirm, sidebar) to its children', () => {
    expect(renderToStaticMarkup(<AppProviders><Probe /></AppProviders>)).toContain('<p>uses ui</p>');
  });
});
