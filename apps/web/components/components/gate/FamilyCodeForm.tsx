'use client';

import { useReducer, useState, type FormEvent } from 'react';
import { Button, TextField } from '@/components/atoms';
import { entryReducer, initialEntryState, type CodeCheckReply, type CodeReply } from '@buxa/shared';

export interface FamilyCodeFormProps<T> {
  /** Sends a code to the email on file, or refuses with a message. The answer is the same whether or not the email is on file. */
  requestCode: (email: string) => Promise<CodeReply>;
  /** Checks the code for the email. A match gives the value; anything else gives the one refusal message. */
  verifyCode: (email: string, code: string) => Promise<CodeCheckReply<T>>;
  /** Called once, after a code matched. */
  onVerified: (value: T) => void;
  /** What the family or staff member is doing, shown above the email field. */
  intro: string;
}

/**
 * The two steps of a code: the email, then the six digits. The steps are one reducer (apps/shared/src/gate/entryFlow.ts), so the form
 * is always in one step. Both the gate and the desk use it.
 */
export function FamilyCodeForm<T>({ requestCode, verifyCode, onVerified, intro }: FamilyCodeFormProps<T>) {
  const [state, dispatch] = useReducer(entryReducer, initialEntryState);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');

  async function sendEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    dispatch({ type: 'emailSubmitted' });
    const reply = await requestCode(email.trim());
    if (reply.kind === 'ok') {
      dispatch({ type: 'codeRequested', email: email.trim(), message: reply.message });
    } else {
      dispatch({ type: 'requestFailed', message: reply.message });
    }
  }

  async function checkCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.step !== 'code') {
      return;
    }
    dispatch({ type: 'codeSubmitted' });
    const reply = await verifyCode(state.email, code.trim());
    if (reply.kind === 'ok') {
      dispatch({ type: 'codeVerified' });
      onVerified(reply.value);
    } else {
      dispatch({ type: 'codeRefused', message: reply.message });
    }
  }

  if (state.step === 'verified') {
    return null;
  }

  if (state.step === 'email') {
    return (
      <form
        onSubmit={event => {
          void sendEmail(event);
        }}
        noValidate
        className="buxa:grid buxa:gap-4"
      >
        <p className="muted">{intro}</p>
        <TextField
          label="Registration email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="off"
          spellCheck={false}
          isRequired
          maxLength={254}
          value={email}
          onChange={setEmail}
          error={state.message}
          errorRole="status"
          hint="The email the registration used. We send a 6-digit code to it."
        />
        <Button variant="glass" fullWidth type="submit" icon="check" disabled={state.busy}>
          {state.busy ? 'Sending…' : 'Send me a code'}
        </Button>
      </form>
    );
  }

  return (
    <form
      onSubmit={event => {
        void checkCode(event);
      }}
      noValidate
      className="buxa:grid buxa:gap-4"
    >
      <p className="muted" role="status" aria-live="polite">
        {state.message ?? 'Enter the 6-digit code.'}
      </p>
      <TextField
        label="6-digit code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        isRequired
        minLength={6}
        maxLength={6}
        value={code}
        onChange={setCode}
        autoFocus
      />
      <Button variant="primary" fullWidth type="submit" icon="check" disabled={state.busy}>
        {state.busy ? 'Checking…' : 'Check code'}
      </Button>
      <Button variant="ghost" type="button" onClick={() => dispatch({ type: 'emailChanged' })}>
        Use a different email
      </Button>
    </form>
  );
}
