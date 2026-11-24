-- Ledger invariants Prisma can't express. Hand-written; Prisma's diff ignores CHECK constraints.

-- Amounts are always positive; the transaction type decides the sign.
ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_amount_positive" CHECK ("amount_minor" > 0);

-- Transfers carry a different destination account and a positive received amount.
ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_transfer_fields" CHECK (
    "type" <> 'TRANSFER'
    OR (
      "to_account_id" IS NOT NULL
      AND "to_amount_minor" IS NOT NULL
      AND "to_amount_minor" > 0
      AND "to_account_id" <> "account_id"
    )
  );

-- Expense / income rows need a category.
ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_category_required" CHECK (
    "type" = 'TRANSFER' OR "category_id" IS NOT NULL
  );

-- budget_mode EXPLICIT <=> budget_id set.
ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_budget_mode" CHECK (
    ("budget_mode" = 'EXPLICIT') = ("budget_id" IS NOT NULL)
  );

-- Same rules for recurring templates.
ALTER TABLE "recurring_rules"
  ADD CONSTRAINT "recurring_rules_amount_positive" CHECK ("amount_minor" > 0),
  ADD CONSTRAINT "recurring_rules_transfer_fields" CHECK (
    "type" <> 'TRANSFER' OR ("to_account_id" IS NOT NULL AND "to_account_id" <> "account_id")
  ),
  ADD CONSTRAINT "recurring_rules_category_required" CHECK (
    "type" = 'TRANSFER' OR "category_id" IS NOT NULL
  ),
  ADD CONSTRAINT "recurring_rules_budget_mode" CHECK (
    ("budget_mode" = 'EXPLICIT') = ("budget_id" IS NOT NULL)
  );

ALTER TABLE "exchange_rates"
  ADD CONSTRAINT "exchange_rates_rate_positive" CHECK ("rate" > 0);
