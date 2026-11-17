// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FOCUSABLE } from '../focus';

// The Dialog focus trap queries with this selector, so it must match what a keyboard user can reach and skip what they cannot.
describe('FOCUSABLE', () => {
  const matches = (html: string) => {
    const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
    return doc.body.querySelectorAll(FOCUSABLE).length;
  };
  it('matches links, enabled controls and positive tabindex', () => {
    expect(matches('<a href="/x">x</a>')).toBe(1);
    expect(matches('<button>b</button><input /><select></select><textarea></textarea>')).toBe(4);
    expect(matches('<div tabindex="0"></div>')).toBe(1);
  });
  it('skips disabled controls and tabindex -1', () => {
    expect(matches('<button disabled>b</button><input disabled />')).toBe(0);
    expect(matches('<div tabindex="-1"></div>')).toBe(0);
  });
});
