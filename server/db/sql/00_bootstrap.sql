-- Create app role + database (run as PostgreSQL superuser).
-- Defaults match .env.example — change the password in production.
--
--   sudo -u postgres psql -f server/db/sql/00_bootstrap.sql
--
-- Preferred (no psql meta-commands): npm run db:bootstrap

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'finance') THEN
    CREATE ROLE finance LOGIN PASSWORD 'finance';
  END IF;
END
$$;

SELECT format('CREATE DATABASE %I OWNER %I', 'finance', 'finance')
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'finance')\gexec

GRANT ALL PRIVILEGES ON DATABASE finance TO finance;

\c finance
GRANT ALL ON SCHEMA public TO finance;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO finance;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO finance;
