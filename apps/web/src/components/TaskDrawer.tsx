import { useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import { Dialog, Field, Menu, PriorityMark, Progress, Avatar, useUi } from './ui';
import { Icon } from './Icon';
import type { Priority, Task } from '../types';
import { PRIORITIES, PRIORITY_LABEL, fmtSize, subtaskProgress } from '../lib/tasks';
import { ago, fmt } from '../lib/dates';
import { useTaskCommands } from './taskCommands';

const MAX_FILE = 1024 * 1024;

export function TaskDrawer() {
  const { drawer, closeTask } = useUi();
  const { s, project } = useStore();
  if (!drawer) return null;
  const task = drawer.id === 'new' ? null : s.tasks.find(t => t.id === drawer.id);
  if (drawer.id !== 'new' && !task) return null;
  const projectId = task?.projectId ?? drawer.defaults?.projectId ?? project?.id;
  if (!projectId) return null;
  return <DrawerInner key={drawer.id} task={task ?? null} projectId={projectId} defaults={drawer.defaults} onClose={closeTask} />;
}

function Tags({ tags, onChange, suggestions }: { tags: string[]; onChange: (t: string[]) => void; suggestions: string[] }) {
  const [v, setV] = useState('');
  const add = () => { const t = v.trim().toLowerCase().replace(/,/g, ''); if (t && !tags.includes(t) && t.length <= 24) onChange([...tags, t]); setV(''); };
  return (
    <div className="tag-input">
      {tags.map(t => <span key={t} className="tag tag-x">{t}<button type="button" aria-label={`Remove tag ${t}`} onClick={() => onChange(tags.filter(x => x !== t))}><Icon name="x" size={11} /></button></span>)}
      <input value={v} list="tag-suggestions" placeholder={tags.length ? '' : 'Add tags'} aria-label="Add a tag" onChange={e => setV(e.target.value)} onBlur={add}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } if (e.key === 'Backspace' && !v && tags.length) onChange(tags.slice(0, -1)); }} />
      <datalist id="tag-suggestions">{suggestions.filter(x => !tags.includes(x)).map(x => <option key={x} value={x} />)}</datalist>
    </div>
  );
}

function DrawerInner({ task, projectId, defaults, onClose }: { task: Task | null; projectId: string; defaults?: { columnId?: string; due?: string }; onClose: () => void }) {
  const { s, actions, me, members, readOnly, userById, wsTasks } = useStore(); const { toast, confirm, openTask } = useUi(); const cmd = useTaskCommands();
  const project = s.projects.find(p => p.id === projectId)!;
  const isNew = !task;
  const [title, setTitle] = useState(task?.title ?? ''); const [desc, setDesc] = useState(task?.description ?? '');
  const [start, setStart] = useState(task?.start ?? ''); const [due, setDue] = useState(task?.due ?? defaults?.due ?? '');
  const [columnId, setColumnId] = useState(task?.columnId ?? defaults?.columnId ?? project.columns[0]?.id ?? '');
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'medium'); const [assignee, setAssignee] = useState(task?.assigneeId ?? me?.id ?? '');
  const [tags, setTags] = useState<string[]>(task?.tags ?? []);
  const [errs, setErrs] = useState<{ title?: string; due?: string }>({});
  const ro = readOnly;
  const allTags = useMemo(() => Array.from(new Set(wsTasks.flatMap(t => t.tags))).sort(), [wsTasks]);
  const col = project.columns.find(c => c.id === (task?.columnId ?? columnId));

  const dateOk = (st: string, du: string) => !(st && du && du < st);
  const commitTitle = () => {
    if (isNew) return;
    const t = title.trim();
    if (!t) { setErrs(e => ({ ...e, title: 'A task needs a title.' })); return; }
    if (t.length > 140) { setErrs(e => ({ ...e, title: 'Keep titles under 140 characters.' })); return; }
    setErrs(e => ({ ...e, title: undefined })); if (t !== task!.title) actions.updateTask(task!.id, { title: t });
  };
  const changeDates = (st: string, du: string, which: 'start' | 'due') => {
    setStart(st); setDue(du);
    if (!dateOk(st, du)) { setErrs(e => ({ ...e, due: 'Due date can’t be before the start date.' })); return; }
    setErrs(e => ({ ...e, due: undefined }));
    if (!isNew) actions.updateTask(task!.id, which === 'start' ? { start: st || undefined } : { due: du || undefined });
  };

  const create = () => {
    const t = title.trim(); const er: typeof errs = {};
    if (!t) er.title = 'A task needs a title.'; else if (t.length > 140) er.title = 'Keep titles under 140 characters.';
    if (!dateOk(start, due)) er.due = 'Due date can’t be before the start date.';
    setErrs(er); if (er.title || er.due) return;
    const id = actions.createTask({ projectId, columnId, title: t, description: desc.trim(), priority, assigneeId: assignee || undefined, start: start || undefined, due: due || undefined, tags });
    toast('Task created'); openTask(id);
  };

  const del = async () => {
    if (!task) return;
    if (await confirm({ title: 'Delete this task?', body: 'Comments, files and history go with it. You can undo right after.', confirmLabel: 'Delete', danger: true })) {
      cmd.remove(task); onClose();
    }
  };

  return (
    <Dialog drawer onClose={onClose} labelledBy="drawer-title">{close => (<>
      <div className="drawer-head" data-sheet-handle>
        <div className="muted small crumbs-mini">{project.name} <Icon name="right" size={12} /> {isNew ? 'New task' : col?.name}</div>
        <span className="grow" />
        {task && !ro && <Menu label="Task actions" trigger={<Icon name="more" />} items={[
          { label: 'Duplicate', icon: 'copy', onSelect: () => openTask(cmd.duplicate(task)) },
          { label: task.archived ? 'Restore' : 'Archive', icon: 'archive', onSelect: () => cmd.toggleArchive(task) },
          { label: '', divider: true, onSelect() {} }, { label: 'Delete', icon: 'trash', danger: true, onSelect: del }]} />}
        <button className="icon-btn" onClick={close} aria-label="Close task"><Icon name="x" /></button>
      </div>

      <fieldset disabled={ro} className="plain">
        <div className="drawer-title">
          <label className="sr-only" htmlFor="drawer-title">Title</label>
          <textarea id="drawer-title" rows={1} value={title} placeholder="Task title" data-autofocus={isNew || undefined} aria-invalid={!!errs.title}
            onChange={e => { setTitle(e.target.value); if (errs.title) setErrs(x => ({ ...x, title: undefined })); }} onBlur={commitTitle}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); isNew ? create() : (e.target as HTMLElement).blur(); } }} />
          {errs.title && <span className="field-error" role="alert">{errs.title}</span>}
          {task?.archived && <span className="tag">Archived</span>}
        </div>

        <div className="props">
          <Field label="Status">
            <select value={task?.columnId ?? columnId} onChange={e => isNew ? setColumnId(e.target.value) : actions.moveTask(task!.id, e.target.value, null)}>
              {project.columns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Priority">
            <span className="select-with"><PriorityMark priority={task?.priority ?? priority} />
              <select value={task?.priority ?? priority} onChange={e => isNew ? setPriority(e.target.value as Priority) : actions.updateTask(task!.id, { priority: e.target.value as Priority })}>
                {PRIORITIES.map(p => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
              </select></span>
          </Field>
          <Field label="Assignee">
            <select value={(isNew ? assignee : task!.assigneeId) ?? ''} onChange={e => isNew ? setAssignee(e.target.value) : actions.updateTask(task!.id, { assigneeId: e.target.value || undefined })}>
              <option value="">Unassigned</option>{members.map(m => <option key={m.userId} value={m.userId}>{m.user.name}</option>)}
            </select>
          </Field>
          <Field label="Start date"><input type="date" value={start} onChange={e => changeDates(e.target.value, due, 'start')} /></Field>
          <Field label="Due date" error={errs.due}><input type="date" value={due} aria-invalid={!!errs.due} onChange={e => changeDates(start, e.target.value, 'due')} /></Field>
          <div className="field span-2"><span className="field-label">Tags</span>
            <Tags tags={task?.tags ?? tags} suggestions={allTags} onChange={t => isNew ? setTags(t) : actions.updateTask(task!.id, { tags: t })} /></div>
        </div>

        <Field label="Description">
          <textarea rows={4} value={desc} placeholder="Add context, links, acceptance criteria…" onChange={e => setDesc(e.target.value)}
            onBlur={() => { if (task && desc !== task.description) actions.updateTask(task.id, { description: desc }); }} />
        </Field>
      </fieldset>

      {isNew ? (
        <div className="row-end sticky-foot"><button className="btn" onClick={close}>Cancel</button><button className="btn btn-primary" onClick={create}>Create task</button></div>
      ) : (
        <TaskSections task={task} ro={ro} members={members.map(m => m.user)} userById={userById} />
      )}
    </>)}</Dialog>
  );
}

function TaskSections({ task, ro, members, userById }: { task: Task; ro: boolean; members: { id: string; name: string }[]; userById: (id?: string) => { name: string } | undefined }) {
  const { actions } = useStore(); const { toast } = useUi();
  const [tab, setTab] = useState<'comments' | 'activity'>('comments');
  const [sub, setSub] = useState(''); const [comment, setComment] = useState(''); const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const sp = subtaskProgress(task);

  const mention = /@([\p{L}]*)$/u.exec(comment);
  const suggestions = mention ? members.filter(m => m.name.split(' ')[0].toLowerCase().startsWith(mention[1].toLowerCase())).slice(0, 4) : [];
  const send = () => { const b = comment.trim(); if (!b) return; if (b.length > 2000) return toast('Comments are limited to 2,000 characters.', { tone: 'error' }); actions.addComment(task.id, b); setComment(''); };

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return; setBusy(true);
    for (const f of Array.from(files)) {
      if (f.size > MAX_FILE) { toast(`“${f.name}” is over 1 MB. Link to it in a comment instead.`, { tone: 'error' }); continue; }
      const dataUrl = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = () => rej(); r.readAsDataURL(f); }).catch(() => '');
      if (!dataUrl) { toast(`Couldn’t read “${f.name}”.`, { tone: 'error' }); continue; }
      actions.addAttachment(task.id, { name: f.name, size: f.size, type: f.type, dataUrl });
    }
    setBusy(false); if (fileRef.current) fileRef.current.value = '';
  };

  const body = (b: string) => b.split(/(@[\p{L}]+)/gu).map((p, i) => (p.startsWith('@') ? <mark key={i} className="mention">{p}</mark> : <span key={i}>{p}</span>));

  return (
    <>
      <section className="section">
        <div className="section-head"><h3>Subtasks</h3>{sp.total > 0 && <span className="muted small">{sp.done} of {sp.total}</span>}</div>
        {sp.total > 0 && <Progress value={(sp.done / sp.total) * 100} label="Subtask progress" />}
        <ul className="checklist">
          {task.subtasks.map(st => (
            <li key={st.id}>
              <label><input type="checkbox" checked={st.done} disabled={ro} onChange={() => actions.toggleSubtask(task.id, st.id)} /><span className={st.done ? 'done' : ''}>{st.title}</span></label>
              {!ro && <button className="icon-btn" aria-label={`Remove subtask ${st.title}`} onClick={() => actions.removeSubtask(task.id, st.id)}><Icon name="x" size={14} /></button>}
            </li>
          ))}
        </ul>
        {!ro && <form className="inline-form" onSubmit={e => { e.preventDefault(); const t = sub.trim(); if (t) { actions.addSubtask(task.id, t); setSub(''); } }}>
          <input value={sub} onChange={e => setSub(e.target.value)} placeholder="Add a subtask" aria-label="New subtask" maxLength={140} /><button className="btn btn-sm" disabled={!sub.trim()}>Add</button></form>}
      </section>

      <section className="section">
        <div className="section-head"><h3>Attachments</h3>
          {!ro && <><input ref={fileRef} type="file" multiple hidden onChange={e => onFiles(e.target.files)} /><button className="btn btn-sm" disabled={busy} onClick={() => fileRef.current?.click()}><Icon name="clip" size={14} />{busy ? 'Uploading…' : 'Attach'}</button></>}</div>
        {task.attachments.length === 0 && <p className="muted small">No files yet. Files up to 1 MB are stored in this browser.</p>}
        <ul className="files">
          {task.attachments.map(a => (
            <li key={a.id}><Icon name="clip" size={15} /><span className="file-name">{a.name}</span><span className="muted small">{fmtSize(a.size)}</span>
              {a.dataUrl && <a className="icon-btn" href={a.dataUrl} download={a.name} aria-label={`Download ${a.name}`}><Icon name="download" size={15} /></a>}
              {!ro && <button className="icon-btn" aria-label={`Remove ${a.name}`} onClick={() => actions.removeAttachment(task.id, a.id)}><Icon name="x" size={14} /></button>}</li>
          ))}
        </ul>
      </section>

      <section className="section">
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'comments'} className={tab === 'comments' ? 'on' : ''} onClick={() => setTab('comments')}>Comments <span className="count">{task.comments.length}</span></button>
          <button role="tab" aria-selected={tab === 'activity'} className={tab === 'activity' ? 'on' : ''} onClick={() => setTab('activity')}>Activity <span className="count">{task.history.length}</span></button>
        </div>
        {tab === 'comments' ? (
          <div role="tabpanel">
            <ul className="thread">
              {task.comments.length === 0 && <li className="muted small">No comments yet. Start the conversation, or @mention a teammate.</li>}
              {task.comments.map(c => (
                <li key={c.id}><Avatar user={userById(c.authorId)} size={28} />
                  <div><div><strong>{userById(c.authorId)?.name ?? 'Someone'}</strong> <span className="muted small">{ago(c.at)}</span></div><p>{body(c.body)}</p></div></li>
              ))}
            </ul>
            {!ro && (
              <div className="composer">
                <textarea rows={2} value={comment} placeholder="Write a comment…  Use @ to mention" aria-label="Write a comment" onChange={e => setComment(e.target.value)}
                  onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); send(); } }} />
                {suggestions.length > 0 && <ul className="mentions" role="listbox">{suggestions.map(m => <li key={m.id}><button type="button" onClick={() => setComment(comment.replace(/@[\p{L}]*$/u, '@' + m.name.split(' ')[0] + ' '))}>{m.name}</button></li>)}</ul>}
                <div className="row-end"><span className="muted small grow">⌘ Enter to send</span><button className="btn btn-primary btn-sm" onClick={send} disabled={!comment.trim()}>Comment</button></div>
              </div>
            )}
          </div>
        ) : (
          <ul className="history" role="tabpanel">
            {task.history.map(h => <li key={h.id}><span className="dot" /><span><strong>{userById(h.actorId)?.name ?? 'System'}</strong> {h.text}{h.via && <span className="via"><Icon name="agent" size={12} />{h.via.reason}</span>}<span className="muted small block">{ago(h.at)}{h.at ? ` · ${fmt(h.at.slice(0, 10))}` : ''}</span></span></li>)}
          </ul>
        )}
      </section>
    </>
  );
}
