import { PageHeader } from '@/components/export';
import { HELP_PAGE, HELP_SECTIONS } from '@/logic/common';
import { HelpSection } from '@/components/export';

/** The whole help page: the page title, then every section in order. */
export function HelpPage() {
  return (
    <div className="page narrow help-page">
      <PageHeader title={HELP_PAGE.title} subtitle={HELP_PAGE.intro} />
      {HELP_SECTIONS.map(section => <HelpSection key={section.id} section={section} />)}
    </div>
  );
}
