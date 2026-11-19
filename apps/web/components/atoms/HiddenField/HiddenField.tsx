/*
 * A value that travels with a form but is not shown: an id, a timezone, a chosen clock format. It renders no control,
 * so it is the one atom with no label; the field it carries is named by the form that owns it.
 */
export interface HiddenFieldProps {
  name: string;
  value: string;
}

export function HiddenField({ name, value }: HiddenFieldProps) {
  return <input type="hidden" name={name} value={value} />;
}
