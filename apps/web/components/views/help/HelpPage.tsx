import { PageHeader } from '@/components/components';
import { HELP_PAGE, HELP_SECTIONS } from '@buxa/shared';
import { HelpSection } from '@/components/components/help';
import { PermissionAreasTable } from '@/components/components/camp';

/** The whole help page: the page title, then every section in order, then the default roles table. */
export function HelpPage() {
  return (
    <div className="page narrow help-page">
      <PageHeader title={HELP_PAGE.title} subtitle={HELP_PAGE.intro} />
      {HELP_SECTIONS.map(section => (
        <HelpSection key={section.id} section={section} />
      ))}
      <PermissionAreasTable />
    </div>
  );
}
