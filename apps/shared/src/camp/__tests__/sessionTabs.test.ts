import { describe, expect, it } from 'vitest';
import { resolveSessionTab, SESSION_TABS, visibleSessionTabs } from '../sessionTabs';
import { sessionTabPath } from '../../config/routes';

describe('visibleSessionTabs', () => {
  it('shows Classes, Registrations and Holds to someone who can read registration', () => {
    expect(visibleSessionTabs(true)).toEqual(['classes', 'registrations', 'holds']);
  });

  it('shows only Classes to someone who cannot read registration (a viewer or a teacher)', () => {
    expect(visibleSessionTabs(false)).toEqual(['classes']);
  });

  it('keeps the tabs in the order the page shows them', () => {
    expect([...SESSION_TABS]).toEqual(['classes', 'registrations', 'holds']);
  });
});

describe('resolveSessionTab', () => {
  const all = visibleSessionTabs(true);

  it('selects the tab the URL names', () => {
    expect(resolveSessionTab('registrations', all)).toBe('registrations');
    expect(resolveSessionTab('holds', all)).toBe('holds');
    expect(resolveSessionTab('classes', all)).toBe('classes');
  });

  it('falls back to Classes for a missing, unknown or empty tab', () => {
    expect(resolveSessionTab(undefined, all)).toBe('classes');
    expect(resolveSessionTab('', all)).toBe('classes');
    expect(resolveSessionTab('bogus', all)).toBe('classes');
    expect(resolveSessionTab('Registrations', all)).toBe('classes');
  });

  it('falls back to Classes for a repeated tab parameter', () => {
    expect(resolveSessionTab(['holds', 'registrations'], all)).toBe('classes');
  });

  it('falls back to Classes for a tab the viewer may not see', () => {
    expect(resolveSessionTab('registrations', visibleSessionTabs(false))).toBe('classes');
    expect(resolveSessionTab('holds', visibleSessionTabs(false))).toBe('classes');
  });
});

describe('sessionTabPath', () => {
  it('puts the tab in the query string of the session page', () => {
    expect(sessionTabPath('11111111-1111-4111-8111-111111111111', 'registrations')).toBe(
      '/camp/sessions/11111111-1111-4111-8111-111111111111?tab=registrations',
    );
  });
});
