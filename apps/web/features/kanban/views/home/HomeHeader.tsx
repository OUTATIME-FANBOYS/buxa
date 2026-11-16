import { PageHeader } from '@/components/ui';
import { RenameCampButton, type CampHome } from '@/features/camp/client';
import { greetingFor } from './greeting';

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
