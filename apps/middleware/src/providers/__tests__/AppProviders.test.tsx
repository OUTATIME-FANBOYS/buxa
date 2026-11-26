import { describe, expect, it } from 'vitest';
import type { ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppProviders } from '../AppProviders';
import { useUi, type ConfirmDialogProps } from '../UiProvider';

const Dialog: ComponentType<ConfirmDialogProps> = ({ title }) => <div role="dialog">{title}</div>;

function Probe() {
  useUi();

  return <p>uses ui</p>;
}

describe('AppProviders', () => {
  it('provides the ui context (toasts, confirm, sidebar) to its children', () => {
    expect(
      renderToStaticMarkup(
        <AppProviders Dialog={Dialog}>
          <Probe />
        </AppProviders>,
      ),
    ).toContain('<p>uses ui</p>');
  });
});
