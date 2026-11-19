import { CAMP_ROLES, CAMP_ROLE_LABELS } from '@buxa/domain';
import { ROUTES } from '@/config/routes';
import type { ListParams } from '@buxa/shared';
import { Button } from '@/components/elements';
import { SearchField, Select } from '@/components/atoms';

/** A plain GET form: works without JavaScript, and the search is bookmarkable (`?q=` and `?role=`). */
export function PeopleSearch({ params }: { params: ListParams }) {
  return (
    <form
      role="search"
      method="get"
      action={ROUTES.people}
      className="form-row buxa:flex buxa:flex-wrap buxa:gap-[var(--s3)] buxa:items-end buxa:[&>.field]:flex-[1_1_180px] buxa:[&>.field]:min-w-0 buxa:[&>.button]:flex-none buxa:[&>a.button]:flex-none"
    >
      <SearchField label="Search by name" name="q" defaultValue={params.q} maxLength={80} autoComplete="off" />
      <Select
        label="Role"
        name="role"
        defaultValue={params.role ?? ''}
        options={[
          { value: '', label: 'All roles' },
          ...CAMP_ROLES.map(role => ({ value: role, label: CAMP_ROLE_LABELS[role] })),
        ]}
      />
      <Button type="submit" icon="search">
        Search
      </Button>
    </form>
  );
}
