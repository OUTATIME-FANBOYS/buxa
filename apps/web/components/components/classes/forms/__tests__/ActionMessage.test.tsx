import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ActionMessage } from '@/components/components/classes/forms';

describe('ActionMessage', () => {
  it('shows no success text inline: the pop-up closes and toasts it', () => {
    expect(renderToStaticMarkup(<ActionMessage state={{ status: 'success', message: 'Ada is enrolled.' }} />)).toBe('');
  });

  it('announces a form-level error as an alert', () => {
    expect(
      renderToStaticMarkup(<ActionMessage state={{ status: 'error', message: 'Choose a camp first.' }} />),
    ).toMatch(/^<p role="alert" class="field-error [^"]*">Choose a camp first\.<\/p>$/);
  });

  it('shows nothing for a field error, which the field itself announces', () => {
    expect(
      renderToStaticMarkup(
        <ActionMessage
          state={{
            status: 'error',
            message: 'Check the highlighted fields.',
            fieldErrors: { name: 'Give it a name.' },
          }}
        />,
      ),
    ).toBe('');
  });

  it('shows nothing while idle', () => {
    expect(renderToStaticMarkup(<ActionMessage state={{ status: 'idle' }} />)).toBe('');
  });
});
