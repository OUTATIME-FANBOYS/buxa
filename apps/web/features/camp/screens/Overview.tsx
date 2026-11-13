import { can } from '@buxa/domain';
import { getRuntime } from '@/server/runtime';
import { AbilitiesPanel } from '../components/AbilitiesPanel';
import { PageHeader } from '../components/PageHeader';
import { Stat } from '../components/Stat';
import { StaffBoardPanel } from '../components/StaffBoardPanel';
import { RenameCampButton } from '../forms/RenameCampButton';
import { ROLE_LABEL } from '../lib/abilities';
import { campContext } from './campContext';

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });

/** The camp's front page. Reads straight from the service: no request to our own API, nothing to wait for in the browser. */
export async function Overview() {
  const { camp, actor } = await campContext();
  const org = await getRuntime().services.orgs.getCamp(actor);

  return (
    <div className="page">
      <PageHeader title={org.name} subtitle={`/${org.slug}`}
        actions={can(actor, 'org:update') && <RenameCampButton campId={org.id} currentName={org.name} />} />
      <section className="grid-3" aria-label="At a glance">
        <Stat label="Members" value={String(org.memberCount)} />
        <Stat label="Your role" value={ROLE_LABEL[camp.role]} />
        <Stat label="Created" value={formatDate(org.createdAt)} />
      </section>
      <div className="grid-2">
        <AbilitiesPanel role={camp.role} />
        <StaffBoardPanel />
      </div>
    </div>
  );
}
