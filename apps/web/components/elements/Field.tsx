import type { ReactNode } from 'react';

export function Field({
  label,
  error,
  children,
  hint,
}: {
  label: string;
  error?: string | null;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field buxa:grid buxa:gap-[6px] buxa:content-start">
      <span className="field-label buxa:text-[length:var(--fs-s)] buxa:font-semibold buxa:text-[var(--text-2)]">
        {label}
      </span>
      {children}
      {hint && !error && (
        <span className="field-hint buxa:text-[length:var(--fs-s)] buxa:text-[var(--text-3)]">{hint}</span>
      )}
      {error && (
        <span className="field-error buxa:text-[length:var(--fs-s)] buxa:text-[var(--crit)]" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}
