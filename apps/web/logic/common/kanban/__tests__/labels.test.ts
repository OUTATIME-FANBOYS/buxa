import { describe, expect, it } from 'vitest';
import { KIND_ICON, STATUS_LABEL, STATUS_TONE, TRUST_LABEL, TRUST_TONE } from '../labels';

describe('agent labels', () => {
  it('gives every proposal status a label and a tone', () => {
    expect(STATUS_LABEL.pending).toBe('Waiting');
    expect(Object.keys(STATUS_TONE).sort()).toEqual(Object.keys(STATUS_LABEL).sort());
  });
  it('names each trust level in the words the settings use', () => {
    expect(TRUST_LABEL).toEqual({ auto: 'Allow', approve: 'Ask me', never: 'Block' });
    expect(TRUST_TONE).toEqual({ auto: 'ok', approve: 'warn', never: 'crit' });
  });
  it('gives every proposal kind an icon', () => {
    expect(KIND_ICON.complete_task).toBe('check');
    expect(Object.keys(KIND_ICON)).toHaveLength(5);
  });
});
