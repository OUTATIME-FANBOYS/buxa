import { Icon } from '@/components/elements';
import type { Tone } from '@buxa/shared';

interface Props {
  tone: Tone;
  title: string;
  body?: string;
}

/** The icon that repeats the tone's meaning, so a result never relies on colour alone. */
const TONE_ICON: Record<Tone, string> = {
  neutral: 'inbox',
  brand: 'clock',
  ok: 'check',
  warn: 'alert',
  crit: 'alert',
  agent: 'agent',
  info: 'info',
};

/** A message with an icon, a title and words, in the tone's colours. Problems are announced assertively; everything else politely. */
export function Notice({ tone, title, body }: Props) {
  return (
    <div className={`notice tone-${tone}`} role={tone === 'crit' ? 'alert' : 'status'}>
      <strong className="notice-title">
        <Icon name={TONE_ICON[tone]} size={20} /> {title}
      </strong>
      {body && <p>{body}</p>}
    </div>
  );
}
