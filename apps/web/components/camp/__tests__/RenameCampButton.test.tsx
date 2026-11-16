import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RenameCampButton } from '../RenameCampButton';

vi.mock('@/logic/composers/camp/renameCampAction', () => ({ renameCampAction: async () => ({ status: 'idle' }) }));

describe('RenameCampButton', () => {
  it('is a Rename button, and the dialog stays closed until it is pressed', () => {
    const html = renderToStaticMarkup(<RenameCampButton campId="o-1" currentName="Camp Birchwood" />);
    expect(html).toContain('>Rename</button>');
    expect(html).not.toContain('role="dialog"');
  });
});
