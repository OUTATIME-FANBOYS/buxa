import { PageHeader } from '@/components/components/export';
import { RenameCampButton } from '@/components/components/camp/export';
import type { CampHome } from '@buxa/server/composers/index.server';
import { greetingFor } from '@buxa/shared';

/** The one header for Home: the greeting, the camp as context, and Rename for the roles allowed to rename (checked on the server). */
export function HomeHeader({ firstName, camp }: { firstName: string; camp: CampHome | null }) {
  const greeting = `${greetingFor(new Date().getHours())}, ${firstName}`;
  return (
    <PageHeader
      title={greeting}
      subtitle={camp ? camp.name : 'Your tasks, kept in this browser'}
      actions={camp?.canRename ? <RenameCampButton campId={camp.campId} currentName={camp.name} /> : undefined}
    />
  );
}
