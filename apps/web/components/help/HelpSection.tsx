import type { HelpSectionContent, HelpSubsection } from '@/logic/common';
import { CodeBlock } from './CodeBlock';
import { ExampleTable } from './ExampleTable';

/** One section: its heading, an optional status, then each subsection with its steps, table and sample. Subsection headings are h3. */
export function HelpSection({ section }: { section: HelpSectionContent }) {
  const headingId = `help-${section.id}`;
  return (
    <section id={section.id} aria-labelledby={headingId} className="help-section panel">
      <h2 id={headingId}>{section.title}</h2>
      {section.availability && (
        <p className="help-status"><strong>{section.availability.label}.</strong> {section.availability.detail}</p>
      )}
      {section.intro.map(text => <p key={text}>{text}</p>)}
      {section.subsections.map(sub => <HelpSubsectionView key={sub.heading} sub={sub} />)}
    </section>
  );
}

function HelpSubsectionView({ sub }: { sub: HelpSubsection }) {
  return (
    <div id={sub.id} className="help-sub">
      <h3>{sub.heading}</h3>
      {sub.paragraphs?.map(text => <p key={text}>{text}</p>)}
      {sub.steps && (
        <ol className="help-steps">
          {sub.steps.map(step => <li key={step}>{step}</li>)}
        </ol>
      )}
      {sub.code && <CodeBlock caption={sub.code.caption} lines={sub.code.lines} />}
      {sub.table && <ExampleTable caption={sub.table.caption} headers={sub.table.headers} rows={sub.table.rows} />}
      {sub.after?.map(text => <p key={text} className="muted">{text}</p>)}
    </div>
  );
}
