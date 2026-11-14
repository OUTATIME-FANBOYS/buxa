/**
 * The one import surface for shared UI: `import { Pill, Dialog, Icon } from '@/components/ui'`.
 * One file per component. Server-safe (no 'use client'): Pill, Avatar, Empty, Field, Progress, Icon, PageHeader and the tone helpers.
 * Client modules: Popover, Menu, Dialog, Segmented, UiProvider.
 */
export { Icon } from './Icon';
export { Pill } from './Pill';
export { Avatar, type AvatarUser } from './Avatar';
export { Empty } from './Empty';
export { PageHeader } from './PageHeader';
export { Field } from './Field';
export { Progress } from './Progress';
export { Segmented } from './Segmented';
export { Popover } from './Popover';
export { Menu, type MenuItem } from './Menu';
export { Dialog, useDialogClose } from './Dialog';
export { UiProvider, useUi, type ConfirmOpts } from './UiProvider';
export { KIND_TONE, type Tone } from './tones';

