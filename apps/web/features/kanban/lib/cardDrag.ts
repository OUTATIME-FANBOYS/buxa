/**
 * Card drag: 1:1 pointer tracking with a lifted ghost, auto-scroll, velocity-carrying spring settle, interruptible.
 * Interface: createDrag(deps) → { grab(event, id), active(), destroy() }. All DOM work is hidden behind it.
 */
import { flushSync } from 'react-dom';
import type { Column, Task } from '../types';
import { haptic, reduceMotion, springAnimate, VelocityTracker } from '@/lib/motion';

/* ---------- Pointer-driven card drag: 1:1 tracking, velocity handoff, interruptible ---------- */
export type Drag = { kind: 'task' | 'column'; id: string } | null;
export type Over = { columnId: string; beforeId: string | null };

let lastDragEnd = 0;
export const justDragged = () => Date.now() - lastDragEnd < 250;

interface DragDeps {
  root: () => HTMLElement | null; setDrag: (d: Drag) => void; setOver: (o: Over | null) => void;
  latest: () => { moveTask: (id: string, col: string, before: string | null) => void; tasks: Task[]; manual: boolean; columns: Column[]; toast: (t: string) => void };
}
interface DragState {
  id: string; el: HTMLElement; type: string; pid: number; sx: number; sy: number; x: number; y: number; offX: number; offY: number; w: number; h: number;
  ghost?: HTMLElement; vel: VelocityTracker; timer?: number; raf?: number; over: Over | null; colEl?: HTMLElement;
}

export function createDrag(d: DragDeps) {
  let s: DragState | null = null; let settling: (() => void) | null = null;

  const findOver = (): Over | null => {
    const root = d.root(); if (!root || !s) return null;
    const cols = Array.from(root.querySelectorAll<HTMLElement>('.column')); if (!cols.length) return null;
    const dist = (c: HTMLElement) => { const r = c.getBoundingClientRect(); return s!.x < r.left ? r.left - s!.x : s!.x > r.right ? s!.x - r.right : 0; };
    const col = cols.reduce((a, b) => (dist(b) < dist(a) ? b : a)); s.colEl = col;
    let before: string | null = null;
    if (d.latest().manual) for (const el of Array.from(col.querySelectorAll<HTMLElement>('[data-card-id]'))) {
      if (el.dataset.cardId === s.id) continue;
      const r = el.getBoundingClientRect(); if (s.y < r.top + r.height / 2) { before = el.dataset.cardId!; break; }
    }
    return { columnId: col.dataset.colId!, beforeId: before };
  };
  const refresh = () => {
    const o = findOver(); if (!o || !s) return;
    if (s.over?.columnId !== o.columnId || s.over.beforeId !== o.beforeId) { s.over = o; d.setOver(o); }
  };
  const loop = () => {
    if (!s?.ghost) return; const root = d.root(); if (!root) return;
    let dx = 0; let dy = 0; const r = root.getBoundingClientRect();
    if (s.x < r.left + 56) dx = -Math.min(14, Math.ceil((56 - (s.x - r.left)) / 4)); else if (s.x > r.right - 56) dx = Math.min(14, Math.ceil((56 - (r.right - s.x)) / 4));
    const body = s.colEl?.querySelector<HTMLElement>('.col-body');
    if (body) { const b = body.getBoundingClientRect(); if (s.y < b.top + 40) dy = -10; else if (s.y > b.bottom - 40) dy = 10; }
    if (dx) root.scrollLeft += dx; if (dy && body) body.scrollTop += dy;
    if (dx || dy) refresh();
    s.raf = requestAnimationFrame(loop);
  };
  const place = () => { if (s?.ghost) s.ghost.style.translate = `${s.x - s.offX}px ${s.y - s.offY}px`; };

  const begin = () => {
    if (!s || s.ghost) return; window.clearTimeout(s.timer);
    const g = s.el.cloneNode(true) as HTMLElement;
    ['data-card-id', 'tabindex'].forEach(a => g.removeAttribute(a)); g.setAttribute('aria-hidden', 'true');
    g.classList.add('card-ghost'); g.style.width = s.w + 'px'; g.style.height = s.h + 'px'; g.style.opacity = '';
    document.body.appendChild(g); s.ghost = g; place();
    requestAnimationFrame(() => g.classList.add('lift'));
    document.body.classList.add('dragging-card'); haptic(8);
    d.setDrag({ kind: 'task', id: s.id }); s.over = findOver(); d.setOver(s.over); loop();
  };
  const onMove = (e: PointerEvent) => {
    if (!s || e.pointerId !== s.pid) return;
    s.x = e.clientX; s.y = e.clientY;
    if (!s.ghost) {
      const dist = Math.hypot(s.x - s.sx, s.y - s.sy);
      if (s.type === 'touch') { if (dist > 10) teardown(); } else if (dist > 5) begin();
      return;
    }
    place(); s.vel.push(s.x, s.y); refresh();
  };
  const onUp = (e: PointerEvent) => { if (s && e.pointerId === s.pid) finish(true); };
  const onCancel = (e: PointerEvent) => { if (s && e.pointerId === s.pid) finish(false); };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && s?.ghost) { e.stopPropagation(); finish(false); } };
  const teardown = () => {
    if (!s) return; window.clearTimeout(s.timer); if (s.raf) cancelAnimationFrame(s.raf);
    removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp); removeEventListener('pointercancel', onCancel); removeEventListener('keydown', onKey, true);
    document.body.classList.remove('dragging-card'); s = null;
  };

  const finish = (commit: boolean) => {
    const cur = s; if (!cur) return;
    const v = cur.vel.get(); const over = cur.over; const ghost = cur.ghost; const from = [cur.x - cur.offX, cur.y - cur.offY];
    teardown(); if (!ghost) return;
    lastDragEnd = Date.now();
    const L = d.latest(); const task = L.tasks.find(t => t.id === cur.id);
    flushSync(() => { if (commit && over) L.moveTask(cur.id, over.columnId, over.beforeId); d.setDrag(null); d.setOver(null); });
    if (commit && over && task && task.columnId !== over.columnId) L.toast(`Moved to ${L.columns.find(c => c.id === over.columnId)?.name ?? 'column'}`);
    const target = d.root()?.querySelector<HTMLElement>(`[data-card-id="${cur.id}"]`);
    if (!target || reduceMotion()) { ghost.remove(); return; }
    target.style.opacity = '0'; const r = target.getBoundingClientRect();
    ghost.classList.remove('lift'); ghost.classList.add('settling');
    const speed = Math.hypot(v[0], v[1]);
    const cancel = springAnimate({
      from, to: [r.left, r.top], velocity: v, damping: speed > 500 ? 0.8 : 1, response: 0.38,
      onFrame: p => { ghost.style.translate = `${p[0]}px ${p[1]}px`; }, onDone: () => end(),
    });
    const end = () => { cancel(); target.style.opacity = ''; ghost.remove(); if (settling === end) settling = null; haptic(4); };
    settling = end;
  };

  return {
    active: () => !!s?.ghost,
    grab(e: React.PointerEvent<HTMLElement>, id: string) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      settling?.(); if (s) return;
      const el = e.currentTarget; const r = el.getBoundingClientRect();
      s = { id, el, type: e.pointerType, pid: e.pointerId, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, offX: e.clientX - r.left, offY: e.clientY - r.top, w: r.width, h: r.height, vel: new VelocityTracker(), over: null };
      addEventListener('pointermove', onMove); addEventListener('pointerup', onUp); addEventListener('pointercancel', onCancel); addEventListener('keydown', onKey, true);
      if (e.pointerType === 'touch') s.timer = window.setTimeout(() => { if (s && !s.ghost) begin(); }, 230);
    },
    destroy() { document.querySelectorAll('.card-ghost').forEach(n => n.remove()); teardown(); },
  };
}

