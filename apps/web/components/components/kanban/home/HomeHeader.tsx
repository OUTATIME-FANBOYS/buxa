import { PageHeader } from '@/components/components';
import type { CampHome } from '@buxa/shared/camp/campHomeTypes';
import { greetingFor } from '@buxa/shared';

/** The one header for Home: the greeting and the camp as context. Renaming the camp is in Settings. */
export function HomeHeader({ firstName, camp }: { firstName: string; camp: CampHome | null }) {
  const greeting = `${greetingFor(new Date().getHours())}, ${firstName}`;

  return <PageHeader title={greeting} subtitle={camp ? camp.name : 'Your tasks, kept in this browser'} />;
}
