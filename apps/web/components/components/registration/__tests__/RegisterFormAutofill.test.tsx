// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RegistrationSeries } from '@buxa/contracts';
import { submitRegistrationAction } from '@/actions/registration';
import { RegisterForm, type RegisterSession } from '../RegisterForm';
import { camper } from './camperFixture';

vi.mock('@/actions/registration', () => ({
  submitRegistrationAction: vi.fn(),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/*
 * The camper and parent sections of Take a registration. Choosing a child fills the camper details and the parent or guardian from the
 * person record, read only. With no parent on file the parent fields are editable. The emergency contact is not on the form, and date
 * of birth and phone sit side by side and are required.
 */

const DAYS = ['2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09', '2026-07-10'] as const;
const SERIES: RegistrationSeries = {
  id: 'ser-1',
  sessionId: 's-1',
  sessionName: 'Art',
  name: 'Pottery',
  ageRange: { minAge: 6, maxAge: 12 },
  capacity: 10,
  location: 'Hall',
  weekdays: [1, 2, 3, 4, 5],
  startTime: '09:00',
  endTime: '11:00',
  firstDay: DAYS[0],
  lastDay: DAYS[4],
  startsLocal: '2026-07-06T09:00',
  endsLocal: '2026-07-10T11:00',
  occurrenceCount: 5,
  activeOccurrenceCount: 5,
  anchorClassId: 'cls-1',
  instructorIds: [],
  instructors: [],
  price: null,
  seatsTaken: 0,
  waitlisted: 0,
  occurrences: DAYS.map(day => ({ startsAt: `${day}T09:00:00Z`, endsAt: `${day}T11:00:00Z` })),
};
const SESSIONS: RegisterSession[] = [{ id: 's-1', name: 'Art', series: [SERIES] }];

const ON_FILE = { name: 'Byron Lovelace', email: 'byron@example.test', phone: '555-0100' };

describe('RegisterForm: the camper and the parent come from the person record', () => {
  let root: Root;
  let host: HTMLDivElement;

  const renderWith = (campers: Parameters<typeof RegisterForm>[0]['campers']) => {
    act(() => {
      root.render(
        <RegisterForm
          formId="form-1"
          sessions={SESSIONS}
          campers={campers}
          timeZone="UTC"
          clockFormat="24h"
          fields={[]}
        />,
      );
    });
  };

  const input = (name: string) => {
    const found = host.querySelector<HTMLInputElement>(`input[name="${name}"]`);
    if (!found) {
      throw new Error(`no input ${name}`);
    }

    return found;
  };

  /** Chooses a child: types the name in the search and picks the match. */
  const chooseChild = (name: string) => {
    const search = host.querySelector<HTMLInputElement>('input[aria-label="Search children"]');
    if (!search) {
      throw new Error('no search box');
    }
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(search, name);
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const match = Array.from(
      host.querySelectorAll<HTMLButtonElement>('ul[aria-label="Matching children"] button'),
    ).find(b => b.textContent === name);
    if (!match) {
      throw new Error(`no match ${name}`);
    }
    act(() => {
      match.click();
    });
  };

  beforeEach(() => {
    vi.mocked(submitRegistrationAction).mockReset();
    host = document.body.appendChild(document.createElement('div'));
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it('fills the camper details from the child and makes them read only', () => {
    renderWith([camper('c-ada', 'Ada', 'Lovelace', { parent: ON_FILE })]);
    chooseChild('Ada Lovelace');

    expect(input('standard.camperFirstName').value).toBe('Ada');
    expect(input('standard.camperFirstName').readOnly).toBe(true);
    expect(input('standard.camperLastName').value).toBe('Lovelace');
    expect(input('standard.camperLastName').readOnly).toBe(true);
    expect(input('standard.camperBirthDate').value).toBe('2014-03-09');
    expect(input('standard.camperBirthDate').readOnly).toBe(true);
  });

  it('gives the read-only camper fields the read-only look, and still submits their values', () => {
    renderWith([camper('c-ada', 'Ada', 'Lovelace', { parent: ON_FILE })]);
    chooseChild('Ada Lovelace');

    expect(input('standard.camperFirstName').classList.contains('field-readonly')).toBe(true);
    expect(input('standard.camperLastName').classList.contains('field-readonly')).toBe(true);
    expect(input('standard.camperBirthDate').classList.contains('field-readonly')).toBe(true);
    expect(input('standard.guardianPhone').classList.contains('field-readonly')).toBe(true);

    const form = host.querySelector('form');
    if (!form) {
      throw new Error('no form');
    }
    const data = new FormData(form);
    expect(data.get('standard.camperFirstName')).toBe('Ada');
    expect(data.get('standard.camperLastName')).toBe('Lovelace');
    expect(data.get('standard.camperBirthDate')).toBe('2014-03-09');
    expect(data.get('standard.guardianPhone')).toBe(ON_FILE.phone);
  });

  it('fills the parent or guardian from the household and makes them read only when one is on file', () => {
    renderWith([camper('c-ada', 'Ada', 'Lovelace', { parent: ON_FILE })]);
    chooseChild('Ada Lovelace');

    expect(input('standard.guardianName').value).toBe(ON_FILE.name);
    expect(input('standard.guardianName').readOnly).toBe(true);
    expect(input('standard.guardianEmail').value).toBe(ON_FILE.email);
    expect(input('standard.guardianEmail').readOnly).toBe(true);
    expect(input('standard.guardianPhone').value).toBe(ON_FILE.phone);
    expect(input('standard.guardianPhone').readOnly).toBe(true);
  });

  it('leaves the parent or guardian editable when none is on file', () => {
    renderWith([camper('c-ben', 'Ben', 'Carter', { parent: null })]);
    chooseChild('Ben Carter');

    expect(input('standard.guardianName').readOnly).toBe(false);
    expect(input('standard.guardianEmail').readOnly).toBe(false);
    expect(input('standard.guardianPhone').readOnly).toBe(false);
    expect(input('standard.guardianPhone').value).toBe('');
  });

  it('keeps the camper details read only even when no parent is on file', () => {
    renderWith([camper('c-ben', 'Ben', 'Carter', { parent: { name: 'Mira Carter', email: null, phone: null } })]);
    chooseChild('Ben Carter');

    expect(input('standard.camperFirstName').readOnly).toBe(true);
    expect(input('standard.camperBirthDate').readOnly).toBe(true);
    // The guardian on file has no phone, so the parent is asked for (and their name is filled in to be checked).
    expect(input('standard.guardianPhone').readOnly).toBe(false);
    expect(input('standard.guardianName').value).toBe('Mira Carter');
  });

  it('has no emergency contact section', () => {
    renderWith([camper('c-ada', 'Ada', 'Lovelace', { parent: ON_FILE })]);

    expect(host.textContent).not.toContain('Emergency contact');
    expect(host.querySelector('input[name="standard.emergencyContactName"]')).toBeNull();
    expect(host.querySelector('input[name="standard.emergencyContactPhone"]')).toBeNull();
  });

  it('shows date of birth and phone side by side, both required', () => {
    renderWith([camper('c-ada', 'Ada', 'Lovelace', { parent: ON_FILE })]);

    const pair = host.querySelector('.form-pair');
    expect(pair).not.toBeNull();
    expect(pair?.querySelector('input[name="standard.camperBirthDate"]')).not.toBeNull();
    expect(pair?.querySelector('input[name="standard.guardianPhone"]')).not.toBeNull();
    expect(input('standard.camperBirthDate').getAttribute('aria-required')).toBe('true');
    expect(input('standard.guardianPhone').getAttribute('aria-required')).toBe('true');
  });
});
