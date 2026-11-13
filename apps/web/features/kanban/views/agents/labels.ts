import type { Tone } from '@/components/ui';
import type { ProposalKind, ProposalStatus, Trust } from '../../types';

export const STATUS_LABEL: Record<ProposalStatus, string> = { pending: 'Waiting', applied: 'Applied automatically', approved: 'Approved', rejected: 'Rejected', blocked: 'Blocked', reverted: 'Reverted' };
export const KIND_ICON: Record<ProposalKind, string> = { create_task: 'plus', comment: 'message', update_task: 'edit', move_task: 'arrowRight', complete_task: 'check' };
export const TRUST_LABEL: Record<Trust, string> = { auto: 'Allow', approve: 'Ask me', never: 'Block' };
export const TRUST_TONE: Record<Trust, Tone> = { auto: 'ok', approve: 'warn', never: 'crit' };
export const STATUS_TONE: Record<ProposalStatus, Tone> = { pending: 'agent', applied: 'neutral', approved: 'ok', rejected: 'crit', blocked: 'warn', reverted: 'neutral' };
