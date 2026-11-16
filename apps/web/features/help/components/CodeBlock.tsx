/** A few lines shown exactly as typed. Long lines scroll inside the block, never the page. */
export function CodeBlock({ caption, lines }: { caption: string; lines: readonly string[] }) {
  return (
    <figure className="help-code">
      <figcaption className="muted">{caption}</figcaption>
      <pre><code>{lines.join('\n')}</code></pre>
    </figure>
  );
}
