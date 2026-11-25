// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { ATTENDANCE_FIELD_IDS, ATTENDANCE_FIELD_LABELS, DEFAULT_ATTENDANCE_FIELDS } from '@buxa/contracts';
import { attendanceExportPath } from '@buxa/shared';
import { AttendanceCsvDownload } from '@/components/components/attendance';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const filter = { from: '2027-07-10', to: '2027-07-12', sessionId: '7a2d3c9f-0b4e-4d6f-9a81-2b3c4d5e6f70' } as const;

describe('AttendanceCsvDownload (server render)', () => {
  it('shows only the Download CSV button until it is opened', () => {
    const html = renderToStaticMarkup(<AttendanceCsvDownload filter={filter} />);
    expect(html).toContain('Download CSV');
    expect(html).not.toContain('name="fields"');
  });
});

describe('AttendanceCsvDownload (column picker)', () => {
  let container: HTMLDivElement;
  let root: Root;
  const navigate = vi.fn<(href: string) => void>();

  beforeEach(() => {
    navigate.mockReset();
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
    act(() => {
      root.render(<AttendanceCsvDownload filter={filter} navigate={navigate} />);
    });
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const button = (text: string): HTMLButtonElement => {
    const found = [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === text);
    if (!found) {
      throw new Error(`no button named ${text}`);
    }

    return found;
  };
  const boxes = (): HTMLInputElement[] => [...document.querySelectorAll<HTMLInputElement>('input[name="fields"]')];
  const ticked = (): string[] =>
    boxes()
      .filter(b => b.checked)
      .map(b => b.value);
  const toggle = (field: string) => {
    const box = boxes().find(b => b.value === field);
    if (!box) {
      throw new Error(`no box for ${field}`);
    }
    act(() => box.click());
  };
  const open = () => act(() => button('Download CSV').click());

  it('lists every column of the log, with the default columns ticked', () => {
    open();
    expect(boxes().map(b => b.value)).toEqual([...ATTENDANCE_FIELD_IDS]);
    expect(boxes().map(b => document.querySelector(`label[for="${b.id}"]`)?.textContent)).toEqual(
      ATTENDANCE_FIELD_IDS.map(field => ATTENDANCE_FIELD_LABELS[field]),
    );
    expect(ticked()).toEqual([...DEFAULT_ATTENDANCE_FIELDS]);
  });

  it('All ticks every column, and None clears them', () => {
    open();
    act(() => button('All').click());
    expect(ticked()).toEqual([...ATTENDANCE_FIELD_IDS]);
    act(() => button('None').click());
    expect(ticked()).toEqual([]);
  });

  it('keeps Download off while no column is ticked', () => {
    open();
    act(() => button('None').click());
    expect(button('Download').disabled).toBe(true);
    toggle('person');
    expect(button('Download').disabled).toBe(false);
  });

  it('downloads the ticked columns in table order, with the filter', () => {
    open();
    act(() => button('None').click());
    toggle('method');
    toggle('person');
    act(() => {
      container.ownerDocument
        .querySelector('form')
        ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(attendanceExportPath(filter, ['person', 'method']));
  });

  it('the file has the default columns when nothing is changed', () => {
    open();
    act(() => {
      container.ownerDocument
        .querySelector('form')
        ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(navigate).toHaveBeenCalledWith(attendanceExportPath(filter, [...DEFAULT_ATTENDANCE_FIELDS]));
  });
});
