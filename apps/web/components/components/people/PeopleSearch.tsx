import Form from 'next/form';
import { CAMP_ROLES, CAMP_ROLE_LABELS } from '@buxa/domain';
import { ROUTES } from '@/config/routes';
import type { ListParams } from '@buxa/shared';
import { Button } from '@/components/elements';
import { SearchField, Select } from '@/components/atoms';

/**
 * A GET form (`?q=` and `?role=`, so the search is bookmarkable and works without JavaScript). next/form navigates on the
 * client, so a search does not reload the whole page.
 */
export function PeopleSearch({ params }: { params: ListParams }) {
  return (
    <Form role="search" action={ROUTES.people} className="form-row">
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
    </Form>
  );
}
