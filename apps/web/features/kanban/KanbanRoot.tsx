import { UiProvider } from '@/components/ui';
import { StoreProvider } from './state/store';
import { TaskDrawerProvider } from './state/TaskDrawerContext';
import { Routes } from './views/Routes';

/** The kanban app with its providers. Browser-only: state and routing live in localStorage and the URL hash. */
export default function KanbanRoot() {
  return <StoreProvider><UiProvider><TaskDrawerProvider><Routes /></TaskDrawerProvider></UiProvider></StoreProvider>;
}
