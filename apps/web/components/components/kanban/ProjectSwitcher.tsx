'use client';

import { Icon } from '@/components/elements';
import { Menu } from '@/components/components';
import { ROUTES, boardPath } from '@/config/routes';
import type { Project } from '@buxa/shared';

const byName = (a: Project, b: Project) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

/**
 * A chevron beside a project's title. It opens the workspace's projects, with the open one checked. Choosing another project
 * opens its board, the same route segment. The list ends with "All projects", which goes to the Projects list.
 */
export function ProjectSwitcher({ projects, current }: { projects: readonly Project[]; current: Project }) {
  return (
    <Menu
      label="Switch project"
      className="project-switch"
      align="start"
      trigger={<Icon name="down" size={14} />}
      items={[...projects].sort(byName).map(p => ({
        label: p.name,
        icon: 'kanban',
        checked: p.id === current.id,
        href: boardPath(p.id),
      }))}
      footer={[
        { label: '', divider: true, onSelect() {} },
        { label: 'All projects', icon: 'folder', href: ROUTES.projects },
      ]}
    />
  );
}
