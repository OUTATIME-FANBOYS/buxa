import type { Membership } from '@buxa/contracts';
import { Empty } from '../../components/ui';
import { useHash } from '../hooks/useHash';
import { parseCampHash } from '../lib/routing';
import { Members } from './Members';
import { NewCamp } from './NewCamp';
import { Overview } from './Overview';

/** Chooses the page for the current address. With no camp yet, the only page is first-run setup. */
export function CampPages({ camp }: { camp: Membership | null }) {
  const route = parseCampHash(useHash());
  if (!camp) return <NewCamp first />;
  switch (route.name) {
    case 'overview': return <Overview camp={camp} />;
    case 'members': return <Members camp={camp} />;
    case 'new': return <NewCamp first={false} />;
    case 'notfound': return <div className="page"><Empty icon="alert" title="Page not found" action={<a className="btn" href="#/camp">Go to overview</a>} /></div>;
  }
}
