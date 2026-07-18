-- MySQL 8.0.25 schema: users, sessions, presets + normalized child tables

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  password_hash TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY users_email_uq (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  token_hash VARCHAR(128) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  UNIQUE KEY sessions_token_hash_uq (token_hash),
  KEY sessions_user_id_idx (user_id),
  KEY sessions_expires_at_idx (expires_at),
  CONSTRAINT sessions_user_id_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS presets (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_private TINYINT(1) NOT NULL DEFAULT 0,
  settings JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY presets_user_id_idx (user_id),
  KEY presets_public_updated_idx (is_private, updated_at),
  CONSTRAINT presets_user_id_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS preset_folders (
  preset_id CHAR(36) NOT NULL,
  id VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  excluded TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (preset_id, id),
  KEY preset_folders_preset_id_idx (preset_id),
  CONSTRAINT preset_folders_preset_id_fk FOREIGN KEY (preset_id) REFERENCES presets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS preset_income_folders (
  preset_id CHAR(36) NOT NULL,
  id VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (preset_id, id),
  KEY preset_income_folders_preset_id_idx (preset_id),
  CONSTRAINT preset_income_folders_preset_id_fk FOREIGN KEY (preset_id) REFERENCES presets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS preset_expense_categories (
  preset_id CHAR(36) NOT NULL,
  id VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (preset_id, id),
  KEY preset_expense_categories_preset_id_idx (preset_id),
  CONSTRAINT preset_expense_categories_preset_id_fk FOREIGN KEY (preset_id) REFERENCES presets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS preset_residence_route (
  preset_id CHAR(36) NOT NULL,
  id VARCHAR(64) NOT NULL,
  country_code VARCHAR(16) NOT NULL,
  tax_regime_id VARCHAR(64) NOT NULL,
  start_date VARCHAR(32) NOT NULL,
  end_date VARCHAR(32) NOT NULL,
  regime_params JSON NULL,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (preset_id, id),
  KEY preset_residence_route_preset_id_idx (preset_id),
  CONSTRAINT preset_residence_route_preset_id_fk FOREIGN KEY (preset_id) REFERENCES presets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS preset_initial_balances (
  preset_id CHAR(36) NOT NULL,
  id VARCHAR(64) NOT NULL,
  amount DOUBLE NOT NULL,
  currency VARCHAR(16) NOT NULL,
  comment TEXT NULL,
  annual_rate DOUBLE NULL,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (preset_id, id),
  KEY preset_initial_balances_preset_id_idx (preset_id),
  CONSTRAINT preset_initial_balances_preset_id_fk FOREIGN KEY (preset_id) REFERENCES presets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS preset_incomes (
  preset_id CHAR(36) NOT NULL,
  id VARCHAR(64) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  name VARCHAR(255) NOT NULL,
  amount DOUBLE NOT NULL,
  currency VARCHAR(16) NOT NULL,
  frequency VARCHAR(32) NOT NULL,
  category VARCHAR(255) NULL,
  category_id VARCHAR(64) NULL,
  lifecycle VARCHAR(32) NULL,
  salary_country_code VARCHAR(16) NULL,
  include_in_residence_tax TINYINT(1) NULL,
  foreign_tax_credit TINYINT(1) NULL,
  payments JSON NULL,
  start_date VARCHAR(32) NOT NULL,
  end_date VARCHAR(32) NULL,
  expense_kind VARCHAR(32) NULL,
  principal DOUBLE NULL,
  term_months INT NULL,
  annual_rate DOUBLE NULL,
  folder_id VARCHAR(64) NULL,
  expense_country_scope VARCHAR(32) NULL,
  route_point_id VARCHAR(64) NULL,
  expense_country_code VARCHAR(16) NULL,
  PRIMARY KEY (preset_id, id),
  KEY preset_incomes_preset_id_idx (preset_id),
  CONSTRAINT preset_incomes_preset_id_fk FOREIGN KEY (preset_id) REFERENCES presets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS preset_expenses (
  preset_id CHAR(36) NOT NULL,
  id VARCHAR(64) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  name VARCHAR(255) NOT NULL,
  amount DOUBLE NOT NULL,
  currency VARCHAR(16) NOT NULL,
  frequency VARCHAR(32) NOT NULL,
  category VARCHAR(255) NULL,
  category_id VARCHAR(64) NULL,
  lifecycle VARCHAR(32) NULL,
  salary_country_code VARCHAR(16) NULL,
  include_in_residence_tax TINYINT(1) NULL,
  foreign_tax_credit TINYINT(1) NULL,
  payments JSON NULL,
  start_date VARCHAR(32) NOT NULL,
  end_date VARCHAR(32) NULL,
  expense_kind VARCHAR(32) NULL,
  principal DOUBLE NULL,
  term_months INT NULL,
  annual_rate DOUBLE NULL,
  folder_id VARCHAR(64) NULL,
  expense_country_scope VARCHAR(32) NULL,
  route_point_id VARCHAR(64) NULL,
  expense_country_code VARCHAR(16) NULL,
  PRIMARY KEY (preset_id, id),
  KEY preset_expenses_preset_id_idx (preset_id),
  CONSTRAINT preset_expenses_preset_id_fk FOREIGN KEY (preset_id) REFERENCES presets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
