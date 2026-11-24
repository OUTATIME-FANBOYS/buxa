import { describe, expect, it } from 'vitest';
import { documentStatusOf, sniffAttachmentType } from './documents';

const bytesOf = (...values: number[]) => new Uint8Array(values);

describe('sniffAttachmentType', () => {
  it('reads PDF and the common image types from their first bytes', () => {
    expect(sniffAttachmentType(new TextEncoder().encode('%PDF-1.7 rest'))).toBe('application/pdf');
    expect(sniffAttachmentType(bytesOf(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
    expect(sniffAttachmentType(bytesOf(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('image/png');
    const webp = bytesOf(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50);
    expect(sniffAttachmentType(webp)).toBe('image/webp');
  });

  it('refuses anything else, whatever it is named', () => {
    expect(sniffAttachmentType(new TextEncoder().encode('just some text'))).toBeNull();
    expect(sniffAttachmentType(bytesOf(0x4d, 0x5a, 0x90, 0x00))).toBeNull(); // a Windows program
    expect(sniffAttachmentType(bytesOf())).toBeNull();
  });
});

describe('documentStatusOf', () => {
  it('shows the stored review when the family sent a file', () => {
    expect(documentStatusOf({ status: 'accepted' }, true)).toBe('accepted');
    expect(documentStatusOf({ status: 'pending' }, false)).toBe('pending');
  });

  it('is Not received for a required question with no file, and nothing for an optional one', () => {
    expect(documentStatusOf(undefined, true)).toBe('not_received');
    expect(documentStatusOf(undefined, false)).toBeNull();
  });
});
