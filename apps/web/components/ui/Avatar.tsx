import { initials } from '@/lib/text';
import { Icon } from './Icon';
import { avatarHue } from './tones';

/** Anything with a name works; `agent` marks a non-human member. */
export interface AvatarUser { name: string; agent?: boolean }

export function Avatar({ user, size = 24 }: { user?: AvatarUser | null; size?: number }) {
  if (!user) return <span className="avatar avatar-empty" style={{ width: size, height: size }} title="Unassigned"><Icon name="user" size={size * 0.55} /></span>;
  if (user.agent) return <span className="avatar avatar-agent" style={{ width: size, height: size }} title={`${user.name} (agent)`} aria-label={`${user.name}, agent`}><Icon name="agent" size={size * 0.55} /></span>;
  return <span className={`avatar avatar-${avatarHue(user.name)}`} style={{ width: size, height: size, fontSize: Math.max(10, size * 0.42) }} title={user.name} aria-label={user.name}>{initials(user.name)}</span>;
}
