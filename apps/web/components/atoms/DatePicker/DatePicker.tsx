'use client';

import type { DateValue } from '@internationalized/date';
import { Calendar } from '@heroui/react/calendar';
import { DateField } from '@heroui/react/date-field';
import { DatePicker as HeroDatePicker } from '@heroui/react/date-picker';
import { Description } from '@heroui/react/description';
import { FieldError } from '@heroui/react/field-error';
import { Label } from '@heroui/react/label';
import type { ReactNode } from 'react';

/*
 * A labelled date with a calendar popover. The value is a calendar date (@internationalized/date), so the atom never
 * parses strings: a form converts at its own boundary (see localDate.ts for the YYYY-MM-DD the server expects).
 * `name` submits the date as HeroUI writes it in a hidden field, so an uncontrolled form still reads YYYY-MM-DD.
 */
export interface DatePickerProps {
  label: string;
  name?: string;
  value?: DateValue | null;
  defaultValue?: DateValue | null;
  onChange?: (value: DateValue | null) => void;
  minValue?: DateValue;
  maxValue?: DateValue;
  error?: string | null;
  hint?: ReactNode;
  isRequired?: boolean;
  isDisabled?: boolean;
  id?: string;
}

export function DatePicker({
  label,
  name,
  value,
  defaultValue,
  onChange,
  minValue,
  maxValue,
  error,
  hint,
  isRequired,
  isDisabled,
  id,
}: DatePickerProps) {
  return (
    <HeroDatePicker
      id={id}
      name={name}
      value={value}
      defaultValue={defaultValue}
      onChange={onChange}
      minValue={minValue}
      maxValue={maxValue}
      isInvalid={Boolean(error)}
      isRequired={isRequired}
      isDisabled={isDisabled}
    >
      <Label>{label}</Label>
      <DateField.Group fullWidth>
        <DateField.Input>{segment => <DateField.Segment segment={segment} />}</DateField.Input>
        <DateField.Suffix>
          <HeroDatePicker.Trigger>
            <HeroDatePicker.TriggerIndicator />
          </HeroDatePicker.Trigger>
        </DateField.Suffix>
      </DateField.Group>
      {error ? <FieldError>{error}</FieldError> : hint ? <Description>{hint}</Description> : null}
      <HeroDatePicker.Popover>
        <Calendar aria-label={label}>
          <Calendar.Header>
            <Calendar.Heading />
            <Calendar.NavButton slot="previous" />
            <Calendar.NavButton slot="next" />
          </Calendar.Header>
          <Calendar.Grid>
            <Calendar.GridHeader>{day => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}</Calendar.GridHeader>
            <Calendar.GridBody>{date => <Calendar.Cell date={date} />}</Calendar.GridBody>
          </Calendar.Grid>
        </Calendar>
      </HeroDatePicker.Popover>
    </HeroDatePicker>
  );
}
