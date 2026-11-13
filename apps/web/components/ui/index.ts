/**
 * The one import surface for shared UI: `import { Pill, Dialog, Icon } from '@/components/ui'`.
 * It re-exports from the original location for now; the shared-UI chunk (A2) replaces the implementation behind it, one file per
 * component, without changing this path or any name exported from it.
 */
export * from '@/features/kanban/components/ui';
export { Icon } from '@/features/kanban/components/Icon';
