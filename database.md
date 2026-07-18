# Схема хранения данных

Рабочий бюджет живёт в `localStorage` браузера. **Пресеты и пользователи** — в **PostgreSQL**. Типы — в `src/types/`.

## Обзор хранилищ

| Хранилище | Где | Ключ / путь | Содержимое |
|-----------|-----|-------------|------------|
| Пресеты, пользователи, сессии | PostgreSQL 16+ | `DATABASE_URL` | `users`, `sessions`, `presets` + дочерние таблицы списков |
| Сид пресетов (файл) | `data/presets.seed.json` | импорт через `npm run db:seed` | публичные наборы |
| Рабочий бюджет | `localStorage` | `family-budget-storage` | Zustand persist: настройки, доходы, расходы, папки, категории |
| UI сайдбара | `localStorage` | ключ сворачивания меню | `'0'` / `'1'` |

Курсы валют в памяти не персистятся (`exchangeRateStore`).

```mermaid
flowchart TB
  subgraph db [PostgreSQL]
    U[users]
    S[sessions]
    P[presets]
    C[preset_* child tables]
  end
  subgraph browser [Браузер localStorage]
    BS["family-budget-storage\nрабочий бюджет"]
  end
  UI[UI] --> BS
  UI -->|API /api/presets + cookie| P
  P --> C
  UI -->|API /api/auth| U
  U --> S
  U --> P
```

---

## 1. PostgreSQL

Подключение: `DATABASE_URL` (см. `.env.example`).

- Локально с Docker: `npm run db:up`, затем `npm run db:migrate` и `npm run db:seed`.
- Без Docker: задайте `PG_ADMIN_URL` (суперпользователь) и выполните `npm run db:setup` (создаёт роль/БД, миграции, сид). SQL вручную: `server/db/sql/00_bootstrap.sql`.

### `users`

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | PK (UUID) |
| `email` | TEXT UNIQUE | Email (нижний регистр) |
| `password_hash` | TEXT | scrypt-хэш пароля |
| `created_at` | TIMESTAMPTZ | Создание |

### `sessions`

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | PK |
| `user_id` | UUID FK → users | Владелец сессии |
| `token_hash` | VARCHAR(128) UNIQUE | SHA-256 токена из cookie `session` |
| `expires_at` | TIMESTAMPTZ | Срок действия |

### `presets`

Метаданные + настройки (списки — в дочерних таблицах):

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | PK |
| `user_id` | UUID FK → users | Владелец |
| `name` / `description` | VARCHAR / TEXT | Название и описание |
| `is_private` | BOOLEAN | Приватный — не в публичном списке |
| `settings` | JSONB | `BudgetSettings` **без** `residenceRoute` / `initialBalances` |
| `created_at` / `updated_at` | TIMESTAMPTZ | Метки времени |

### Дочерние таблицы (PK `(preset_id, id)`, `ON DELETE CASCADE`)

| Таблица | Содержимое |
|--------|------------|
| `preset_folders` | папки расходов (`name`, `sort_order`, `excluded`) |
| `preset_income_folders` | папки доходов |
| `preset_expense_categories` | пользовательские категории расходов |
| `preset_residence_route` | точки маршрута (`country_code`, `tax_regime_id`, даты, `regime_params` JSON) |
| `preset_initial_balances` | начальные остатки |
| `preset_incomes` | доходы (`RecurringItem` → колонки; `payments` JSON) |
| `preset_expenses` | расходы (тот же набор колонок) |

На границе API строки собираются в клиентский `BudgetPreset.data` (`server/presetPayload.ts` + `server/presetChildren.ts`).

Публичный список: `is_private = false`. «Мои»: `user_id` текущей сессии. Приватный чужой пресет — 404.

Авторизация: `POST /api/auth/register|login|logout`, `GET /api/auth/me`. Cookie `session` (HttpOnly).

---

## 2. Браузер: рабочий бюджет (`family-budget-storage`)

Zustand persist (`src/store/budgetStore.ts`). Сохраняется:

| Поле | Тип |
|------|-----|
| `settings` | `BudgetSettings` |
| `incomes` | `RecurringItem[]` |
| `expenses` | `RecurringItem[]` |
| `folders` | `ExpenseFolder[]` |
| `incomeFolders` | `ExpenseFolder[]` |
| `expenseCategories` | `ExpenseCategory[]` |
| `oneTimeExpenses` | всегда `[]` |
| `activePreset` | `{ id, name, ownerId? } \| null` |

`presetBaseline` (для «несохранённых изменений») в persist не входит.

---

## 3. Вложенные сущности

### `BudgetSettings`

| Поле | Тип | Описание |
|------|-----|----------|
| `baseCurrency` | `string` | Базовая валюта отчёта |
| `countryCode` | `string` | Legacy: страна проживания |
| `taxRegimeId` | `string` | Legacy: налоговый режим |
| `familySize` | `number` | Размер семьи |
| `dependents` | `number` | Иждивенцы |
| `countryDeductions?` | `{ TH?: ThailandDeductionSettings }` | Вычеты по странам |
| `relocationDate?` | ISO date | Дата переезда (legacy) |
| `relocationProgramId?` | `string` | Программа переезда |
| `relocationMode?` | `remote_employment` \| `sole_proprietorship` | Способ переезда |
| `employmentCountryCode?` | `string` | **deprecated** — страна зарплаты в доходах |
| `residenceRoute?` | `ResidenceRoutePoint[]` | Маршрут проживания → `preset_residence_route` |
| `horizonMonths` | `number` | Горизонт планирования, мес. |
| `initialBalances?` | `InitialBalanceEntry[]` | Начальные остатки → `preset_initial_balances` |
| `initialBalance` | `number` | **deprecated** |
| `initialBalanceCurrency` | `string` | **deprecated** |
| `initialBalanceDate` | ISO date | Дата начального остатка |
| `parkBalanceOnSavingsAccount?` | `boolean` | Накопительный счёт |
| `savingsAnnualRate?` | `number` | Ставка %, legacy |
| `savingsAccountCurrency?` | `string` | Валюта накопительного счёта |
| `currencyConversionFeePercent?` | `number` | Комиссия за конвертацию, % к курсу ЦБ |

### `ResidenceRoutePoint`

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | `string` | ID точки |
| `countryCode` | `string` | Страна |
| `taxRegimeId` | `string` | Налоговый режим |
| `startDate` / `endDate` | ISO date | Период проживания |
| `regimeParams?` | `ThailandDeductionSettings` | Параметры режима (вычеты и т.п.) |

### `InitialBalanceEntry`

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | `string` | ID строки |
| `amount` | `number` | Сумма |
| `currency` | `string` | Валюта (могут повторяться) |
| `comment?` | `string` | Комментарий |
| `annualRate?` | `number` | Годовая ставка накопительного счёта для этой валюты, % |

### `RecurringItem` (доходы и расходы)

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | `string` | ID |
| `name` | `string` | Название |
| `amount` | `number` | Сумма (для кредита — может дублировать платёж) |
| `currency` | `string` | Валюта |
| `frequency` | `monthly` \| `yearly` \| `weekly` \| `once` | Периодичность |
| `category?` | `string` | Имя категории |
| `categoryId?` | `string` | Служебный id (`salary` и т.п.) |
| `lifecycle?` | `destination` \| `origin` \| `any` | Привязка к этапу переезда |
| `salaryCountryCode?` | `string` | Страна зарплаты |
| `includeInResidenceTax?` | `boolean` | Учитывать в налогах страны проживания |
| `foreignTaxCredit?` | `boolean` | Зачёт иностранного НДФЛ |
| `payments?` | `IncomePayment[]` | Разбивка выплат зарплаты |
| `startDate` | ISO date | Начало |
| `endDate?` | ISO date | Окончание |
| `expenseKind?` | `regular` \| `loan` | Вид расхода |
| `principal?` / `termMonths?` / `annualRate?` | `number` | Параметры кредита |
| `folderId?` | `string` | Папка |
| `expenseCountryScope?` | `employment` \| `residence` \| `other` | Страна расхода |
| `routePointId?` | `string` | Привязка к пункту маршрута |
| `expenseCountryCode?` | `string` | **deprecated** |

`IncomePayment`: `{ label, amount, dayOfMonth? }`.

### `ExpenseFolder` / `ExpenseCategory`

Как раньше: id, name, sortOrder; у папок расходов — `excluded?`.

Встроенные категории в JSON не хранятся — константы в коде.

### `OneTimeExpense` (legacy)

При загрузке мигрирует в `expenses` с `frequency: "once"`.

---

## 4. Связи

```mermaid
erDiagram
  users ||--o{ sessions : has
  users ||--o{ presets : owns
  presets ||--o{ preset_folders : has
  presets ||--o{ preset_income_folders : has
  presets ||--o{ preset_expense_categories : has
  presets ||--o{ preset_residence_route : has
  presets ||--o{ preset_initial_balances : has
  presets ||--o{ preset_incomes : has
  presets ||--o{ preset_expenses : has
```

Рабочий бюджет и пресет — одна форма `BudgetPresetData` (экспорт/импорт через `exportSnapshot` / `loadFromPreset`).

---

## 5. Что не хранится

- Результаты прогноза (`MonthlySnapshot` / `DailySnapshot`) — считаются на лету.
- Курсы ЦБ — только в памяти сессии.
- Встроенные списки категорий и валют — константы в коде.
