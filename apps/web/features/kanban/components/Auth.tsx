import { useReducer, useState } from 'react';
import { useStore } from '../state/store';
import { authFormReducer, initialAuthForm, validateAuth } from '../state/authForm';
import { Field, Icon } from '@/components/ui';
import { DEMO_PASSWORD } from '../lib/seed';

export function Auth() {
  const { s, actions } = useStore();
  const [form, dispatch] = useReducer(authFormReducer, initialAuthForm);
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [pw, setPw] = useState('');
  const { mode } = form; const errs = form.phase === 'editing' ? form.errors : {}; const busy = form.phase === 'submitting';
  const demoUsers = s.users.filter(u => s.accounts.some(a => a.userId === u.id && a.demo)).slice(0, 3);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const er = validateAuth(mode, name, email, pw);
    dispatch({ type: 'invalid', errors: er }); if (Object.keys(er).length) return;
    dispatch({ type: 'submitStarted' });
    const msg = mode === 'in' ? await actions.signIn(email, pw) : await actions.signUp(name, email, pw);
    dispatch({ type: 'finished', message: msg });
  };

  return (
    <main className="auth">
      <aside className="auth-hero" aria-hidden="true">
        <div className="brand brand-lg"><span className="logo"><Icon name="kanban" size={18} /></span> Buxa</div>
        <div className="hero-copy">
          <p className="hero-title">One board for you, your team and your agents.</p>
          <ul>
            <li><Icon name="kanban" size={16} />Plan work on a fast, simple Kanban board</li>
            <li><Icon name="agent" size={16} />Let AI agents propose tickets and changes</li>
            <li><Icon name="check" size={16} />Approve what matters, with a full audit trail</li>
          </ul>
        </div>
        <div className="hero-board">
          <span className="hb-col"><i className="kind-dot kind-open" /><b /><b /><b /></span>
          <span className="hb-col"><i className="kind-dot kind-active" /><b /><b /></span>
          <span className="hb-col"><i className="kind-dot kind-done" /><b /><b /><b /></span>
        </div>
      </aside>
      <div className="auth-card">
        <div className="brand brand-lg auth-brand"><span className="logo" aria-hidden="true"><Icon name="kanban" size={18} /></span> Buxa</div>
        <h1>{mode === 'in' ? 'Welcome back' : 'Create your account'}</h1>
        <p className="muted">{mode === 'in' ? 'Sign in to pick up where your team left off.' : 'A workspace with a first board is created for you.'}</p>
        <form onSubmit={submit} noValidate>
          {mode === 'up' && <Field label="Name" error={errs.name}><input value={name} onChange={e => setName(e.target.value)} autoComplete="name" data-autofocus autoFocus /></Field>}
          <Field label="Email" error={errs.email}><input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" autoFocus={mode === 'in'} /></Field>
          <Field label="Password" error={errs.pw}><input type="password" value={pw} onChange={e => setPw(e.target.value)} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} /></Field>
          {errs.form && <p className="field-error" role="alert">{errs.form}</p>}
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'One moment…' : mode === 'in' ? 'Sign in' : 'Create account'}</button>
        </form>
        <p className="auth-switch muted">
          {mode === 'in' ? 'New here?' : 'Already have an account?'}{' '}
          <button className="link" onClick={() => dispatch({ type: 'switchMode' })}>{mode === 'in' ? 'Create an account' : 'Sign in'}</button>
        </p>
        <div className="auth-demo">
          <span className="eyebrow">Explore the demo workspace</span>
          {demoUsers.map(u => (
            <button key={u.id} className="btn btn-block demo-btn" onClick={() => actions.switchUser(u.id)}>
              <span className="avatar" style={{ width: 24, height: 24, fontSize: 10 }}>{u.name.split(' ').map(p => p[0]).join('')}</span>
              <span>Continue as {u.name}</span><small className="muted">{u.title}</small>
            </button>
          ))}
          <p className="muted small">Data stays in this browser. Demo accounts use the password <code>{DEMO_PASSWORD}</code>.</p>
        </div>
      </div>
    </main>
  );
}
