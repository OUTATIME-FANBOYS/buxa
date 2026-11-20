import { CATEGORY_PERMISSIONS, PERMISSION_CATEGORIES, coverage, type Coverage, type Role } from '@buxa/domain';

const ROLE_COLUMNS: readonly { role: Role; label: string }[] = [
  { role: 'viewer', label: 'Viewer' },
  { role: 'staff', label: 'Staff' },
  { role: 'admin', label: 'Admin' },
  { role: 'owner', label: 'Owner' },
];

const WORDS: Record<Coverage, string> = { all: 'All', some: 'Some', none: 'None' };

/** Read-only reference: which areas each role holds. Permission names are not shown; the server checks them. */
export function PermissionAreasTable() {
  return (
    <section aria-labelledby="permission-areas-title">
      <h2 id="permission-areas-title">What each role can do</h2>
      <p className="muted small">The default roles, read only.</p>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Area</th>
              {ROLE_COLUMNS.map(({ role, label }) => (
                <th scope="col" key={role}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_CATEGORIES.map(category => {
              const notYet = CATEGORY_PERMISSIONS[category].length === 0;

              return (
                <tr key={category}>
                  <th scope="row">{category}</th>
                  {ROLE_COLUMNS.map(({ role }) => (
                    <td key={role}>{notYet ? 'Not yet' : WORDS[coverage(role, category)]}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
