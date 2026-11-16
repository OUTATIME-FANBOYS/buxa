import { useStore } from '../state/store';
import { useUi } from '../../../components/ui/UiProvider';

/**
 * Restores the browser demo (the Camp Birchwood staff sample) from the single seed source, after a confirmation. It changes only this
 * browser's saved data: the database is never touched.
 */
export function ResetDemoButton() {
  const { actions } = useStore();
  const { toast, confirm } = useUi();
  const reset = async () => {
    const ok = await confirm({
      title: 'Reset demo data?',
      body: 'This replaces everything in this browser with the Camp Birchwood sample, including tasks, projects and changes you made.',
      confirmLabel: 'Reset',
      danger: true,
    });
    if (!ok) return;
    actions.resetDemo();
    toast('Demo data restored');
  };
  return <button className="btn btn-danger-ghost" onClick={reset}>Reset demo data</button>;
}
