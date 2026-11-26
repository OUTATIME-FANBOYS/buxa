import { Button } from '@/components/elements';
import { SearchField } from '@/components/atoms';

interface PersonFinderProps {
  /** The page the search goes to (a household's page, when linking into it). */
  action: string;
  query: string;
}

/**
 * A plain GET form that searches the camp by name for someone to link. Bookmarkable (`?q=`) and works without JavaScript.
 * The search is capped by the service, so a short name is the way to find someone on a large camp.
 */
export function PersonFinder({ action, query }: PersonFinderProps) {
  return (
    <form
      role="search"
      method="get"
      action={action}
      className="form-row buxa:flex buxa:flex-wrap buxa:gap-[var(--s3)] buxa:items-end buxa:[&>.field]:flex-[1_1_180px] buxa:[&>.field]:min-w-0 buxa:[&>.button]:flex-none buxa:[&>a.button]:flex-none"
    >
      <SearchField label="Find someone by name" name="q" defaultValue={query} maxLength={80} autoComplete="off" />
      <Button type="submit" iconOnly icon="search" aria-label="Search people by name" />
    </form>
  );
}
