import { describe, expect, it } from 'vitest';
import { formDraftDiffers, type FormValues } from './draft';

const S1 = '11111111-1111-4111-8111-111111111111';
const S2 = '22222222-2222-4222-8222-222222222222';
const QUESTION = { kind: 'yes_no', key: 'photos', label: 'Photo consent', required: true };

const published: FormValues = { name: 'Summer', season: 'Summer 2027', sessionIds: [S1], fields: [QUESTION] };

describe('formDraftDiffers', () => {
  it('is false when the draft matches the published version', () => {
    expect(formDraftDiffers({ ...published }, published)).toBe(false);
  });

  it('is true for a changed name, season, session set or question', () => {
    expect(formDraftDiffers({ ...published, name: 'Summer 2' }, published)).toBe(true);
    expect(formDraftDiffers({ ...published, season: 'Autumn' }, published)).toBe(true);
    expect(formDraftDiffers({ ...published, season: null }, published)).toBe(true);
    expect(formDraftDiffers({ ...published, sessionIds: [S1, S2] }, published)).toBe(true);
    expect(formDraftDiffers({ ...published, fields: [] }, published)).toBe(true);
  });

  it('ignores the order of the sessions, but not the order of the questions', () => {
    const two: FormValues = { ...published, sessionIds: [S1, S2] };
    expect(formDraftDiffers({ ...two, sessionIds: [S2, S1] }, two)).toBe(false);
    const second = { kind: 'text', key: 'allergies', label: 'Allergies', required: false };
    const ordered: FormValues = { ...published, fields: [QUESTION, second] };
    expect(formDraftDiffers({ ...ordered, fields: [second, QUESTION] }, ordered)).toBe(true);
  });

  it('treats a missing season as the same as a missing season on the other side', () => {
    expect(formDraftDiffers({ ...published, season: null }, { ...published, season: null })).toBe(false);
  });
});
