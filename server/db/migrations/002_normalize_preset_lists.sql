-- Normalize preset list JSONB columns into child tables.

CREATE TABLE IF NOT EXISTS preset_folders (
  preset_id UUID NOT NULL REFERENCES presets(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  excluded BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (preset_id, id)
);
CREATE INDEX IF NOT EXISTS preset_folders_preset_id_idx ON preset_folders(preset_id);

CREATE TABLE IF NOT EXISTS preset_income_folders (
  preset_id UUID NOT NULL REFERENCES presets(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (preset_id, id)
);
CREATE INDEX IF NOT EXISTS preset_income_folders_preset_id_idx ON preset_income_folders(preset_id);

CREATE TABLE IF NOT EXISTS preset_expense_categories (
  preset_id UUID NOT NULL REFERENCES presets(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (preset_id, id)
);
CREATE INDEX IF NOT EXISTS preset_expense_categories_preset_id_idx ON preset_expense_categories(preset_id);

CREATE TABLE IF NOT EXISTS preset_residence_route (
  preset_id UUID NOT NULL REFERENCES presets(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  country_code TEXT NOT NULL,
  tax_regime_id TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  regime_params JSONB,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (preset_id, id)
);
CREATE INDEX IF NOT EXISTS preset_residence_route_preset_id_idx ON preset_residence_route(preset_id);

CREATE TABLE IF NOT EXISTS preset_initial_balances (
  preset_id UUID NOT NULL REFERENCES presets(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  currency TEXT NOT NULL,
  comment TEXT,
  annual_rate DOUBLE PRECISION,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (preset_id, id)
);
CREATE INDEX IF NOT EXISTS preset_initial_balances_preset_id_idx ON preset_initial_balances(preset_id);

CREATE TABLE IF NOT EXISTS preset_incomes (
  preset_id UUID NOT NULL REFERENCES presets(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  name TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  currency TEXT NOT NULL,
  frequency TEXT NOT NULL,
  category TEXT,
  category_id TEXT,
  lifecycle TEXT,
  salary_country_code TEXT,
  include_in_residence_tax BOOLEAN,
  foreign_tax_credit BOOLEAN,
  payments JSONB,
  start_date TEXT NOT NULL,
  end_date TEXT,
  expense_kind TEXT,
  principal DOUBLE PRECISION,
  term_months INT,
  annual_rate DOUBLE PRECISION,
  folder_id TEXT,
  expense_country_scope TEXT,
  route_point_id TEXT,
  expense_country_code TEXT,
  PRIMARY KEY (preset_id, id)
);
CREATE INDEX IF NOT EXISTS preset_incomes_preset_id_idx ON preset_incomes(preset_id);

CREATE TABLE IF NOT EXISTS preset_expenses (
  preset_id UUID NOT NULL REFERENCES presets(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  name TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  currency TEXT NOT NULL,
  frequency TEXT NOT NULL,
  category TEXT,
  category_id TEXT,
  lifecycle TEXT,
  salary_country_code TEXT,
  include_in_residence_tax BOOLEAN,
  foreign_tax_credit BOOLEAN,
  payments JSONB,
  start_date TEXT NOT NULL,
  end_date TEXT,
  expense_kind TEXT,
  principal DOUBLE PRECISION,
  term_months INT,
  annual_rate DOUBLE PRECISION,
  folder_id TEXT,
  expense_country_scope TEXT,
  route_point_id TEXT,
  expense_country_code TEXT,
  PRIMARY KEY (preset_id, id)
);
CREATE INDEX IF NOT EXISTS preset_expenses_preset_id_idx ON preset_expenses(preset_id);

-- Migrate existing JSONB arrays (preserve array order in sort_order).
INSERT INTO preset_folders (preset_id, id, name, sort_order, excluded)
SELECT
  p.id,
  COALESCE(elem->>'id', 'folder-' || ord.ordinality::text),
  COALESCE(elem->>'name', ''),
  (ord.ordinality - 1)::int,
  COALESCE((elem->>'excluded')::boolean, false)
FROM presets p
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.folders, '[]'::jsonb)) WITH ORDINALITY AS ord(elem, ordinality)
ON CONFLICT DO NOTHING;

INSERT INTO preset_income_folders (preset_id, id, name, sort_order)
SELECT
  p.id,
  COALESCE(elem->>'id', 'income-folder-' || ord.ordinality::text),
  COALESCE(elem->>'name', ''),
  (ord.ordinality - 1)::int
FROM presets p
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.income_folders, '[]'::jsonb)) WITH ORDINALITY AS ord(elem, ordinality)
ON CONFLICT DO NOTHING;

INSERT INTO preset_expense_categories (preset_id, id, name, sort_order)
SELECT
  p.id,
  COALESCE(elem->>'id', 'category-' || ord.ordinality::text),
  COALESCE(elem->>'name', ''),
  (ord.ordinality - 1)::int
FROM presets p
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.expense_categories, '[]'::jsonb)) WITH ORDINALITY AS ord(elem, ordinality)
ON CONFLICT DO NOTHING;

INSERT INTO preset_residence_route (
  preset_id, id, country_code, tax_regime_id, start_date, end_date, regime_params, sort_order
)
SELECT
  p.id,
  COALESCE(elem->>'id', 'route-' || ord.ordinality::text),
  COALESCE(elem->>'countryCode', ''),
  COALESCE(elem->>'taxRegimeId', ''),
  COALESCE(elem->>'startDate', '1970-01-01'),
  COALESCE(elem->>'endDate', '9999-12-31'),
  CASE WHEN elem ? 'regimeParams' THEN elem->'regimeParams' ELSE NULL END,
  (ord.ordinality - 1)::int
FROM presets p
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.residence_route, '[]'::jsonb)) WITH ORDINALITY AS ord(elem, ordinality)
ON CONFLICT DO NOTHING;

INSERT INTO preset_initial_balances (
  preset_id, id, amount, currency, comment, annual_rate, sort_order
)
SELECT
  p.id,
  COALESCE(elem->>'id', 'balance-' || ord.ordinality::text),
  COALESCE((elem->>'amount')::double precision, 0),
  COALESCE(elem->>'currency', 'EUR'),
  elem->>'comment',
  CASE WHEN elem ? 'annualRate' THEN (elem->>'annualRate')::double precision ELSE NULL END,
  (ord.ordinality - 1)::int
FROM presets p
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.initial_balances, '[]'::jsonb)) WITH ORDINALITY AS ord(elem, ordinality)
ON CONFLICT DO NOTHING;

INSERT INTO preset_incomes (
  preset_id, id, sort_order, name, amount, currency, frequency,
  category, category_id, lifecycle, salary_country_code,
  include_in_residence_tax, foreign_tax_credit, payments,
  start_date, end_date, expense_kind, principal, term_months, annual_rate,
  folder_id, expense_country_scope, route_point_id, expense_country_code
)
SELECT
  p.id,
  COALESCE(elem->>'id', 'income-' || ord.ordinality::text),
  (ord.ordinality - 1)::int,
  COALESCE(elem->>'name', ''),
  COALESCE((elem->>'amount')::double precision, 0),
  COALESCE(elem->>'currency', 'EUR'),
  COALESCE(elem->>'frequency', 'monthly'),
  elem->>'category',
  elem->>'categoryId',
  elem->>'lifecycle',
  elem->>'salaryCountryCode',
  CASE WHEN elem ? 'includeInResidenceTax' THEN (elem->>'includeInResidenceTax')::boolean ELSE NULL END,
  CASE WHEN elem ? 'foreignTaxCredit' THEN (elem->>'foreignTaxCredit')::boolean ELSE NULL END,
  CASE WHEN elem ? 'payments' THEN elem->'payments' ELSE NULL END,
  COALESCE(elem->>'startDate', '1970-01-01'),
  elem->>'endDate',
  elem->>'expenseKind',
  CASE WHEN elem ? 'principal' THEN (elem->>'principal')::double precision ELSE NULL END,
  CASE WHEN elem ? 'termMonths' THEN (elem->>'termMonths')::int ELSE NULL END,
  CASE WHEN elem ? 'annualRate' THEN (elem->>'annualRate')::double precision ELSE NULL END,
  elem->>'folderId',
  elem->>'expenseCountryScope',
  elem->>'routePointId',
  elem->>'expenseCountryCode'
FROM presets p
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.incomes, '[]'::jsonb)) WITH ORDINALITY AS ord(elem, ordinality)
ON CONFLICT DO NOTHING;

INSERT INTO preset_expenses (
  preset_id, id, sort_order, name, amount, currency, frequency,
  category, category_id, lifecycle, salary_country_code,
  include_in_residence_tax, foreign_tax_credit, payments,
  start_date, end_date, expense_kind, principal, term_months, annual_rate,
  folder_id, expense_country_scope, route_point_id, expense_country_code
)
SELECT
  p.id,
  COALESCE(elem->>'id', 'expense-' || ord.ordinality::text),
  (ord.ordinality - 1)::int,
  COALESCE(elem->>'name', ''),
  COALESCE((elem->>'amount')::double precision, 0),
  COALESCE(elem->>'currency', 'EUR'),
  COALESCE(elem->>'frequency', 'monthly'),
  elem->>'category',
  elem->>'categoryId',
  elem->>'lifecycle',
  elem->>'salaryCountryCode',
  CASE WHEN elem ? 'includeInResidenceTax' THEN (elem->>'includeInResidenceTax')::boolean ELSE NULL END,
  CASE WHEN elem ? 'foreignTaxCredit' THEN (elem->>'foreignTaxCredit')::boolean ELSE NULL END,
  CASE WHEN elem ? 'payments' THEN elem->'payments' ELSE NULL END,
  COALESCE(elem->>'startDate', '1970-01-01'),
  elem->>'endDate',
  elem->>'expenseKind',
  CASE WHEN elem ? 'principal' THEN (elem->>'principal')::double precision ELSE NULL END,
  CASE WHEN elem ? 'termMonths' THEN (elem->>'termMonths')::int ELSE NULL END,
  CASE WHEN elem ? 'annualRate' THEN (elem->>'annualRate')::double precision ELSE NULL END,
  elem->>'folderId',
  elem->>'expenseCountryScope',
  elem->>'routePointId',
  elem->>'expenseCountryCode'
FROM presets p
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.expenses, '[]'::jsonb)) WITH ORDINALITY AS ord(elem, ordinality)
ON CONFLICT DO NOTHING;

ALTER TABLE presets
  DROP COLUMN IF EXISTS residence_route,
  DROP COLUMN IF EXISTS initial_balances,
  DROP COLUMN IF EXISTS incomes,
  DROP COLUMN IF EXISTS expenses,
  DROP COLUMN IF EXISTS folders,
  DROP COLUMN IF EXISTS income_folders,
  DROP COLUMN IF EXISTS expense_categories;
