import { personPath } from '@/config/routes';
import { Button } from '@/components/elements/export';
import { SearchField } from '@/components/atoms';

interface PersonFinderProps {
  personId: string;
  query: string;
}

/**
 * A plain GET form that searches the camp by name for someone to link. Bookmarkable (`?q=`) and works without JavaScript.
 * The search is capped by the service, so a short name is the way to find someone on a large camp.
 */
export function PersonFinder({ personId, query }: PersonFinderProps) {
  return (
    <form role="search" method="get" action={personPath(personId)} className="form-row">
      <SearchField label="Find someone by name" name="q" defaultValue={query} maxLength={80} autoComplete="off" />
      <Button type="submit" iconOnly icon="search" aria-label="Search people by name" />
    </form>
  );
}
