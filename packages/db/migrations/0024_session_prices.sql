-- v0.3: a Session (a row of `classes`) can carry a price, shown for information only. Nothing is charged in this phase.
-- Amounts are integers in the smallest currency unit (cents, yen), with an ISO 4217 code. The early-bird amount and its end
-- date are both set or both empty. Expand only: nothing is dropped. The table already has row-level security and grants
-- (migrations 0007 and 0008), which cover these columns.

ALTER TABLE classes
  ADD COLUMN price_minor integer CHECK (price_minor IS NULL OR price_minor BETWEEN 0 AND 99999999999),
  ADD COLUMN price_currency char(3) CHECK (price_currency IS NULL OR price_currency ~ '^[A-Z]{3}$'),
  ADD COLUMN early_bird_minor integer CHECK (early_bird_minor IS NULL OR early_bird_minor BETWEEN 0 AND 99999999999),
  ADD COLUMN early_bird_until date,
  ADD CONSTRAINT classes_price_shape CHECK (
    (price_minor IS NULL AND price_currency IS NULL AND early_bird_minor IS NULL AND early_bird_until IS NULL)
    OR (
      price_minor IS NOT NULL AND price_currency IS NOT NULL
      AND ((early_bird_minor IS NULL) = (early_bird_until IS NULL))
      AND (early_bird_minor IS NULL OR early_bird_minor <= price_minor)
    )
  );
