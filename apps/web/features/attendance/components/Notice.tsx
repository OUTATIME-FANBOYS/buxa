import type { Tone } from '@/components/ui/tones';

interface Props { tone: Tone; title: string; body?: string }

/** A message with a title and words, in the tone's colours. Problems are announced assertively; everything else politely. */
export function Notice({ tone, title, body }: Props) {
  return (
    <div className={`notice tone-${tone}`} role={tone === 'crit' ? 'alert' : 'status'}>
      <strong>{title}</strong>
      {body && <p>{body}</p>}
    </div>
  );
}
