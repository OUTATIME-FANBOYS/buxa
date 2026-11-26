import { settle } from '@buxa/domain';
import type { Logger } from '../log';

/** A code message. Its text is the same whether it is sent or shown in development. */
export interface CodeMessage {
  to: string;
  code: string;
  campName: string;
  purpose: 'gate' | 'desk';
  expiresInMinutes: number;
}

/**
 * Where a check-in code goes. The app has no email provider configured yet (no sender in the repository, and invites are only listed in
 * the dev outbox), so the production implementation sends nothing and says so in the log. It never logs the code or the address.
 */
export interface CodeSender {
  send(message: CodeMessage): Promise<void>;
}

/** The text of the message: short, and the same for every family. */
export function codeMessageText(message: CodeMessage): { subject: string; body: string } {
  const reason =
    message.purpose === 'desk'
      ? 'A staff member at the desk asked for this code so you can check your child in.'
      : 'You asked to check your child in at the gate.';

  return {
    subject: `Your check-in code for ${message.campName}`,
    body: [
      reason,
      '',
      `Your code is ${message.code}.`,
      `It works for ${message.expiresInMinutes} minutes. If you did not ask for it, ignore this message.`,
    ].join('\n'),
  };
}

/**
 * The sender the runtime uses. In development it writes the message to the server log, code included, so a developer can check in
 * without an email account. In every other environment it sends nothing and logs that no provider is configured.
 */
export function createCodeSender(options: {
  environment: 'development' | 'test' | 'production';
  log: Logger;
}): CodeSender {
  return {
    send: message =>
      settle(() => {
        if (options.environment === 'development') {
          const text = codeMessageText(message);
          options.log.warn({ subject: text.subject, body: text.body }, 'development only: check-in code not emailed');

          return;
        }
        options.log.warn(
          { purpose: message.purpose },
          'check-in code not sent: no email provider is configured for this deployment',
        );
      }),
  };
}

/** Keeps every message in memory, for tests. */
export function createMemoryCodeSender(): CodeSender & { readonly sent: CodeMessage[] } {
  const sent: CodeMessage[] = [];

  return {
    sent,
    send: message =>
      settle(() => {
        sent.push(message);
      }),
  };
}
