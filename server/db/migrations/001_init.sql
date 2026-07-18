-- users, sessions, presets
-- pgcrypto (gen_random_uuid) is installed by `npm run db:bootstrap` as superuser.
-- On PostgreSQL 13+ gen_random_uuid() is in core; extension is still harmless if present.

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_private BOOLEAN NOT NULL DEFAULT false,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  residence_route JSONB NOT NULL DEFAULT '[]'::jsonb,
  initial_balances JSONB NOT NULL DEFAULT '[]'::jsonb,
  incomes JSONB NOT NULL DEFAULT '[]'::jsonb,
  expenses JSONB NOT NULL DEFAULT '[]'::jsonb,
  folders JSONB NOT NULL DEFAULT '[]'::jsonb,
  income_folders JSONB NOT NULL DEFAULT '[]'::jsonb,
  expense_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS presets_user_id_idx ON presets(user_id);
CREATE INDEX IF NOT EXISTS presets_public_updated_idx ON presets(updated_at DESC)
  WHERE is_private = false;
