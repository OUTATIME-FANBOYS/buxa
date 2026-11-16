'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ROUTES } from '@/config';
import { demoUsers, enterDemo, type DemoUser } from '@/features/kanban/state/demoEntry';
import { DEMO_PASSWORD } from '@/features/kanban/lib/seed/ids';

/**
 * The browser demo's accounts, offered on the sign-in page. Picking one opens the task pages as that account.
 * It is not a sign-in: no session is created, and the demo data stays in this browser. Real sign-in is the form above it.
 */
export function DemoSignIn() {
  const router = useRouter();
  const [users, setUsers] = useState<DemoUser[]>([]);
  useEffect(() => { setUsers(demoUsers()); }, []);
  if (users.length === 0) return null;
  return (
    <div className="auth-demo">
      <span className="eyebrow">Explore the demo workspace</span>
      {users.map(u => (
        <button key={u.id} type="button" className="btn btn-block demo-btn" onClick={() => { enterDemo(u.id); router.push(ROUTES.camp); }}>
          <span className="avatar" style={{ width: 24, height: 24, fontSize: 10 }}>{u.name.split(' ').map(p => p[0]).join('')}</span>
          <span>Continue as {u.name}</span><small className="muted">{u.title}</small>
        </button>
      ))}
      <p className="muted small">Data stays in this browser. Demo accounts use the password <code>{DEMO_PASSWORD}</code>.</p>
    </div>
  );
}
