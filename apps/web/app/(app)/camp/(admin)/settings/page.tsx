import type { Metadata } from 'next';
import { authorize } from '@buxa/domain';
import { campContext, loadCampProfile } from '@buxa/server/composers/index.server';
import { CampClockPanel } from '@/components/components/camp/export';
import { SettingsPage } from '@/components/views/kanban/export';

export const metadata: Metadata = { title: 'Settings' };

export default async function Page() {
  const { actor, camp } = await campContext();
  const org = await loadCampProfile(actor);

  return (
    <SettingsPage leading={<CampClockPanel campId={camp.orgId} clockFormat={org.clockFormat} canChange={authorize(actor, 'org:update').allow} />} />
  );
}
