import Link from 'next/link';
import type { Class } from '@buxa/contracts';
import { classPath } from '@/config/routes';

const ratioText = (cls: Class): string =>
  cls.instructorRatio ? `${cls.instructorRatio.instructors}:${cls.instructorRatio.campers}` : 'Not set';

/** The camp's classes: name, ages, default places and the instructor ratio (stored; not enforced yet). */
export function ClassesTable({ classes }: { classes: readonly Class[] }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <caption className="sr-only">Classes in the camp</caption>
        <thead>
          <tr>
            <th scope="col">Class</th>
            <th scope="col">Ages</th>
            <th scope="col">Default places</th>
            <th scope="col">Instructor ratio</th>
          </tr>
        </thead>
        <tbody>
          {classes.map(cls => (
            <tr key={cls.id}>
              <td>
                <Link className="row-title classes-target" href={classPath(cls.id)}>
                  {cls.name}
                </Link>
              </td>
              <td>
                {cls.ageRange.minAge} to {cls.ageRange.maxAge}
              </td>
              <td>{cls.capacity}</td>
              <td>{ratioText(cls)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
