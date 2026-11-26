/** The cookie that holds a verified phone's device token. Set only by the gate's server action, read only on the server. */
export const GATE_DEVICE_COOKIE = 'buxa_gate_device';

/** One child booked into a session today, as the gate and the desk list them. Carries no contact details. */
export interface GateChildLine {
  personId: string;
  givenName: string;
  familyName: string;
  sessionId: string;
  sessionName: string;
  onSite: boolean;
}

/** What a code request or a code check says to the screen. Refusals carry the one message that is safe to show. */
export type CodeReply = { kind: 'ok'; message: string } | { kind: 'refused'; message: string };
export type CodeCheckReply<T> = { kind: 'ok'; value: T } | { kind: 'refused'; message: string };
