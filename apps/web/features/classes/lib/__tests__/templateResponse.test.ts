import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IMPORT_COLUMNS, type Actor } from '@buxa/domain';
import { createImportService } from '@/server/classes/import/ImportService';
import { InMemoryClassRepository } from '@/server/classes/InMemoryClassRepository';
import { InMemoryImportRepository } from '@/server/classes/import/InMemoryImportRepository';
import { CAMP_TZ, ORG } from '@/server/classes/__tests__/fixtures';

const h = vi.hoisted(() => ({ actor: null as null | Actor, services: {} as Record<string, unknown> }));
vi.mock('@/server/runtime', () => ({ getRuntime: () => ({ services: h.services }) }));
vi.mock('@/features/people/lib/camp', () => ({ currentActor: async () => h.actor }));

const { classTemplateResponse } = await import('../templateResponse');

beforeEach(() => {
  const classes = new InMemoryClassRepository(() => new Date('2027-07-01T00:00:00Z'));
  const imports = new InMemoryImportRepository(classes);
  h.services = { imports: createImportService({ classes, imports, timezoneOf: async () => CAMP_TZ }) };
  h.actor = { userId: 'u1', orgId: ORG, role: 'staff' };
});

describe('classTemplateResponse', () => {
  it('sends the blank template as a CSV download, with the column names and a byte-order mark', async () => {
    const response = await classTemplateResponse();
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
    expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="buxa-classes-template.csv"');
    // The first three bytes are the UTF-8 byte-order mark; text() would strip it, so the bytes are checked directly.
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes).replace(/^﻿/, '');
    expect(text.trim()).toBe(IMPORT_COLUMNS.join(','));
  });

  it('answers a viewer with 403 and no file', async () => {
    h.actor = { userId: 'u2', orgId: ORG, role: 'viewer' };
    const response = await classTemplateResponse();
    expect(response.status).toBe(403);
    expect(response.headers.get('Content-Disposition')).toBeNull();
  });

  it('asks for a camp when there is none', async () => {
    h.actor = null;
    expect((await classTemplateResponse()).status).toBe(404);
  });
});
