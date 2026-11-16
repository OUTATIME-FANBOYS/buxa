// @vitest-environment jsdom
import { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScanField, type ScanFieldHandle } from './ScanField';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

interface HarnessProps { onScan: (raw: string) => void; disabled?: boolean; handle: React.RefObject<ScanFieldHandle | null> }

function Harness({ onScan, disabled, handle }: HarnessProps) {
  return (
    <>
      <ScanField ref={handle} label="Scan a badge" disabled={disabled} onScan={onScan} />
      <button type="button">Elsewhere</button>
      <div tabIndex={0} id="plain">Plain text</div>
    </>
  );
}

let host: HTMLDivElement;
let root: Root;

const field = () => host.querySelector('input') as HTMLInputElement;
const form = () => host.querySelector('form') as HTMLFormElement;
const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });

function render(props: Omit<HarnessProps, 'handle'> & { handle?: React.RefObject<ScanFieldHandle | null> }) {
  const handle = props.handle ?? createRef<ScanFieldHandle>();
  act(() => root.render(<Harness {...props} handle={handle} />));
  return handle;
}

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

describe('ScanField focus', () => {
  it('takes focus on mount', () => {
    render({ onScan: () => {} });
    expect(document.activeElement).toBe(field());
  });

  it('the handle puts focus back after focus has moved to another control', () => {
    const handle = render({ onScan: () => {} });
    act(() => (host.querySelector('button') as HTMLButtonElement).focus());
    expect(document.activeElement).not.toBe(field());
    act(() => handle.current?.focus());
    expect(document.activeElement).toBe(field());
  });

  it('the handle does nothing while the field is disabled', () => {
    const handle = render({ onScan: () => {}, disabled: true });
    act(() => handle.current?.focus());
    expect(document.activeElement).not.toBe(field());
  });

  it('takes focus back once it is enabled again after the screen has been busy', () => {
    const onScan = vi.fn();
    const handle = render({ onScan, disabled: false });
    // While a check-in is written the field is disabled, and focus leaves it when the user moves on.
    render({ onScan, disabled: true, handle });
    act(() => (host.querySelector('button') as HTMLButtonElement).focus());
    render({ onScan, disabled: false, handle });
    expect(document.activeElement).toBe(field());
  });

  it('after a scan: reports the code, clears the field and keeps focus in it', () => {
    const onScan = vi.fn();
    render({ onScan });
    act(() => { field().value = '  bx1.abc  '; });
    act(() => form().requestSubmit());
    expect(onScan).toHaveBeenCalledWith('bx1.abc');
    expect(field().value).toBe('');
    expect(document.activeElement).toBe(field());
  });

  it('takes focus back when the user taps something that is not a control', async () => {
    render({ onScan: () => {} });
    act(() => (host.querySelector('#plain') as HTMLDivElement).focus());
    await flush();
    expect(document.activeElement).toBe(field());
  });
});
